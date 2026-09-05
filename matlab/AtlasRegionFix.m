classdef AtlasRegionFix < handle
% ATLASREGIONFIX  Mark what is wrong with a region on one plate of the Gerbil Atlas, and send it.
%
%   The app draws no region by hand: its extents are cut from the traced outlines
%   (svg/) and the printed labels (seeds), so a region that comes out wrong is one of
%   those inputs being wrong. This class brings a plate down from the website -- the
%   drawing, the tracing, the extents as they stand, the printed labels and their
%   leader lines -- lays them over each other in millimetres, and lets you mark what
%   is wrong: a seed for the name a face should carry, the run of boundary the
%   tracing missed, the outline a region should have. commit() writes the marks to
%   corrections/<id>.json on a branch correction/<id> and pushes it; a workflow then
%   hands the file to Claude, which applies it, rebuilds, and merges once CI is green.
%
%   A = AtlasRegionFix(19)                              % plate 19 from the site, cached
%   A = AtlasRegionFix(19, 'Repo', 'C:\src\GerbilAtlasExplorer')   % from a clone; commit through git
%   A.show                                              % the plate in mm: tracing, extents, labels
%   A.select('S1DZ')                                    % the region in question
%   A.problem('S1DZ on the left is a scrap; S1J bulges through the gap between it and S1FL')
%   A.addSeed('S1DZ')                                   % click inside it; or A.addSeed('S1DZ', [-4.13 -2.88])
%   A.addBoundary('Style', 'dashed')                    % draw the run of boundary the tracing missed
%   A.addExtent('S1DZ')                                 % or pull the region's own outline into shape
%   A.preview                                           % which face each seed lands in, with the draft
%   A.commit                                            % corrections/<id>.json on correction/<id>, pushed
%
%   Coordinates: everything you see and click is stereotaxic millimetres (ML across,
%   DV up, AP the plate's bregma). What is written is the page frame of the tracings
%   (3296 x 2481 px), through the plate's own registration matrix, with the mm beside
%   it -- the same numbers tools/corrections.py reads. See matlab/README.md.
%
%   Needs MATLAB R2021a or later and the Image Processing Toolbox (drawpoint,
%   drawpolyline, drawpolygon, bwlabel, imfill). Nothing else.

    properties (Constant)
        Version = '1.0'
        Schema = 'gerbil-atlas-correction/1'
        Owner = 'dstolz'
        RepoName = 'GerbilAtlasExplorer'
        DefaultSite = 'https://dstolz.github.io/GerbilAtlasExplorer/'
        BridgePx = 20        % page px a dangling end is joined across: build_region_extents.BRIDGE_PX
        MinFacePx = 400      % page px under which a face is tracer noise: build_region_extents.MIN_FACE_PX
        SupportPx = 3        % page px within which a boundary counts as drawn: build_region_extents.SUPPORT_PX
    end

    properties (SetAccess = private)
        Plate double         % 1..62
        Site char            % where the assets come from
        Repo char            % a local clone, or ''
        CacheDir char
        Commit char          % the commit the assets were read from, as far as it can be known
        Bregma double        % AP of this plate, mm
        Frame struct         % plate_frame: the 1100 x 703 plate image in mm
        M double             % [a b c d e f]: page px -> plate px, x' = a x + c y + e, y' = b x + d y + f
        Page struct          % W, H of the traced page
        Paths struct         % the tracing: d, style, closed, pts (N x 2 page px), stroke, dash
        Outline cell         % the section outline, rings in mm
        Extents struct       % every region on the plate: abbr, name, rings (cell of N x 2 mm), area_mm2, traced, w
        Unassigned cell      % the faces the atlas seals and does not name, rings in mm
        Labels table         % every printed label on the plate, with its box and, where drawn, its line
        Structures table     % abbr, name for the whole atlas
        Draft struct         % what has been marked: problem, seeds, boundaries, extents, notes
    end

    properties
        Abbr char = ''       % the region the correction is about
        Layer char = 'drawing'   % 'drawing' | 'nissl' | 'myelin' | 'mri'
        Author char = ''     % written into the file; defaults to the login name
        Token char = ''      % a GitHub token, for committing without a clone (else GITHUB_TOKEN)
    end

    properties (Access = private)
        Fig
        Ax
        Img
        H = struct()         % graphics handles by layer
        Images = struct()    % plate images by layer
        Faces = []           % the preview raster, until the draft changes it
    end

    % ================================================================ construction
    methods
        function A = AtlasRegionFix(plate, opts)
            arguments
                plate (1,1) double {mustBeInteger, mustBeInRange(plate, 1, 62)}
                opts.Site (1,1) string = AtlasRegionFix.DefaultSite
                opts.Repo (1,1) string = ""
                opts.CacheDir (1,1) string = fullfile(prefdir, 'GerbilAtlasExplorer')
                opts.Refresh (1,1) logical = false
                opts.Layer (1,1) string = "drawing"
                opts.Abbr (1,1) string = ""
                opts.Author (1,1) string = ""
                opts.Token (1,1) string = ""
            end
            A.Plate = plate;
            A.Site = char(opts.Site);
            if ~endsWith(A.Site, '/'), A.Site(end+1) = '/'; end
            A.Repo = char(opts.Repo);
            A.CacheDir = char(opts.CacheDir);
            A.Layer = char(opts.Layer);
            A.Abbr = char(opts.Abbr);
            A.Author = char(opts.Author);
            A.Token = char(opts.Token);
            A.Draft = struct('problem', '', 'hemisphere', '', 'seeds', {{}}, ...
                'boundaries', {{}}, 'extents', {{}}, 'notes', {{}});
            A.loadAssets(opts.Refresh);
            if ~isempty(A.Abbr), A.select(A.Abbr); end
        end
    end

    methods (Access = private)
        function loadAssets(A, refresh)
            % The database: the frame, the registration matrix, the plate table and
            % the structure list. Nothing keyed by abbreviation is read from it, because
            % jsondecode rewrites "10Cb" as x10Cb; those come from the geojson and the CSV.
            db = jsondecode(fileread(A.fetch('data/gerbil_atlas.json', refresh)));
            A.Frame = db.plate_frame;
            A.M = reshape(db.plate_registration.data.(sprintf('x%d', A.Plate)), 1, 6);
            plates = db.plates;
            if ~iscell(plates), plates = num2cell(plates); end
            pn = cellfun(@(p) p.plate, plates);
            A.Bregma = plates{pn == A.Plate}.bregma;
            S = db.structures;
            if ~iscell(S), S = num2cell(S); end
            A.Structures = table(string(cellfun(@(x) x.abbr, S(:), 'UniformOutput', false)), ...
                string(cellfun(@(x) x.name, S(:), 'UniformOutput', false)), ...
                'VariableNames', {'abbr', 'name'});
            A.Commit = A.stamp(db);

            % the tracing, in the page frame it was traced in
            txt = fileread(A.fetch(sprintf('svg/GerbilAtlas_Plate_%02d.svg', A.Plate), refresh));
            vb = regexp(txt, 'viewBox="([^"]+)"', 'tokens', 'once');
            vb = sscanf(vb{1}, '%f');
            A.Page = struct('W', vb(3), 'H', vb(4));
            A.Paths = AtlasRegionFix.parseSvg(txt);

            % the extents, the unnamed faces and the section outline, all in mm
            g = jsondecode(fileread(A.fetch(sprintf('data/geojson/plate_%02d.geojson', A.Plate), refresh)));
            feats = g.features;
            if ~iscell(feats), feats = num2cell(feats); end
            ext = struct('abbr', {}, 'name', {}, 'rings', {}, 'area_mm2', {}, 'traced', {}, 'w', {});
            A.Unassigned = {};
            A.Outline = {};
            for k = 1:numel(feats)
                f = feats{k};
                p = f.properties;
                rings = AtlasRegionFix.ringsOf(f.geometry.coordinates);
                ab = '';
                if isfield(p, 'abbr') && ~isempty(p.abbr), ab = char(p.abbr); end
                if strcmp(ab, 'brain_outline')
                    A.Outline = [A.Outline, rings];
                elseif isempty(ab)
                    A.Unassigned = [A.Unassigned, rings];
                else
                    tr = [];
                    if isfield(p, 'traced_fraction'), tr = p.traced_fraction(:)'; end
                    w = isfield(p, 'no_drawn_outline') && ~isempty(p.no_drawn_outline) && p.no_drawn_outline;
                    ext(end+1) = struct('abbr', ab, 'name', char(p.name), 'rings', {rings}, ...
                        'area_mm2', p.area_mm2, 'traced', tr, 'w', w); %#ok<AGROW>
                end
            end
            A.Extents = ext;

            % the printed labels of this plate, with where each one points
            csv = A.fetch('data/gerbil_atlas_labels.csv', refresh);
            io = detectImportOptions(csv, 'TextType', 'string');
            io = setvartype(io, {'abbr', 'name', 'position_from'}, 'string');
            T = readtable(csv, io);
            T = T(T.plate == A.Plate, :);
            T.has_line = ~isnan(T.leader_tip_x_frac);
            A.Labels = T;
        end

        function s = stamp(A, db)
            % The commit the assets came from: git's answer in a clone; on the site, the
            % tip of main if the API answers, else the day the database was generated.
            s = '';
            if ~isempty(A.Repo)
                [st, out] = system(sprintf('git -C "%s" rev-parse --short HEAD', A.Repo));
                if st == 0, s = strtrim(out); end
            end
            if isempty(s)
                try
                    r = webread(sprintf('https://api.github.com/repos/%s/%s/commits/main', ...
                        A.Owner, A.RepoName), weboptions('Timeout', 10));
                    s = r.sha(1:7);
                catch
                    s = ['main@' char(db.version.generated)];
                end
            end
        end

        function p = fetch(A, rel, refresh)
            % A repository file, from the clone when there is one, else from the site
            % through the cache.
            if ~isempty(A.Repo)
                p = fullfile(A.Repo, rel);
                if isfile(p), return; end
                warning('AtlasRegionFix:notInClone', '%s is not in %s; fetching from the site', rel, A.Repo);
            end
            p = fullfile(A.CacheDir, rel);
            if refresh || ~isfile(p)
                d = fileparts(p);
                if ~isfolder(d), mkdir(d); end
                url = [A.Site rel];
                try
                    websave(p, url, weboptions('Timeout', 60));
                catch err
                    if isfile(p), delete(p); end
                    error('AtlasRegionFix:fetch', 'could not fetch %s: %s', url, err.message);
                end
            end
        end

        function img = plateImage(A, layer)
            layer = lower(char(layer));
            if ~ismember(layer, {'drawing', 'nissl', 'myelin', 'mri'})
                error('AtlasRegionFix:layer', 'no layer %s: drawing, nissl, myelin or mri', layer);
            end
            if ~isfield(A.Images, layer)
                A.Images.(layer) = imread(A.fetch(sprintf('data/plates/%s/%02d.jpg', layer, A.Plate), false));
            end
            img = A.Images.(layer);
        end
    end

    % ================================================================ frames
    methods
        function [xp, yp] = pageToPlate(A, x, y)
            m = A.M;
            xp = m(1) * x + m(3) * y + m(5);
            yp = m(2) * x + m(4) * y + m(6);
        end

        function [x, y] = plateToPage(A, xp, yp)
            m = A.M;
            det = m(1) * m(4) - m(2) * m(3);
            x = ( m(4) * (xp - m(5)) - m(3) * (yp - m(6))) / det;
            y = (-m(2) * (xp - m(5)) + m(1) * (yp - m(6))) / det;
        end

        function [ml, dv] = plateToMm(A, xp, yp)
            ml = (xp - A.Frame.ml_zero_px) / A.Frame.ml_px_per_mm;
            dv = (A.Frame.dv_zero_px - yp) / A.Frame.dv_px_per_mm;
        end

        function [xp, yp] = mmToPlate(A, ml, dv)
            xp = A.Frame.ml_zero_px + ml * A.Frame.ml_px_per_mm;
            yp = A.Frame.dv_zero_px - dv * A.Frame.dv_px_per_mm;
        end

        function mm = pageToMm(A, xy)
            % N x 2 page px -> N x 2 [ML DV] mm
            [xp, yp] = A.pageToPlate(xy(:, 1), xy(:, 2));
            [ml, dv] = A.plateToMm(xp, yp);
            mm = [ml, dv];
        end

        function xy = mmToPage(A, mm)
            [xp, yp] = A.mmToPlate(mm(:, 1), mm(:, 2));
            [x, y] = A.plateToPage(xp, yp);
            xy = [x, y];
        end

        function mm = fracToMm(A, fx, fy)
            % fractions of the plate image, as label_positions has them -> mm
            [ml, dv] = A.plateToMm(fx * A.Frame.width_px, fy * A.Frame.height_px);
            mm = [ml, dv];
        end
    end

    % ================================================================ the picture
    methods
        function show(A, opts)
            % SHOW  The plate in mm: image, tracing, extents, labels, outline and the draft.
            arguments
                A
                opts.Layer (1,1) string = string(A.Layer)
                opts.Labels (1,1) logical = true
                opts.Extents (1,1) logical = true
            end
            A.Layer = char(opts.Layer);
            img = A.plateImage(A.Layer);
            [h, w, ~] = size(img);
            sx = A.Frame.width_px / w;              % 1 for the 1100 x 703 plates, 2 for the MRI
            sy = A.Frame.height_px / h;
            [x0, ytop] = A.plateToMm(0.5 * sx, 0.5 * sy);
            [x1, ybot] = A.plateToMm((w - 0.5) * sx, (h - 0.5) * sy);
            if isempty(A.Fig) || ~isvalid(A.Fig)
                A.Fig = figure('Name', sprintf('Plate %d  bregma %+.2f mm', A.Plate, A.Bregma), ...
                    'NumberTitle', 'off', 'Color', 'w');
            end
            figure(A.Fig);
            clf(A.Fig);
            A.Ax = axes(A.Fig);
            % rows are flipped and YData rises so that DV reads upward with no ambiguity
            A.Img = image(A.Ax, 'XData', [x0 x1], 'YData', [ybot ytop], 'CData', flipud(img));
            if ismatrix(img), colormap(A.Ax, gray(256)); end
            set(A.Ax, 'YDir', 'normal', 'DataAspectRatio', [1 1 1], 'Box', 'on', ...
                'XGrid', 'on', 'YGrid', 'on', 'GridAlpha', 0.15);
            hold(A.Ax, 'on');
            xlabel(A.Ax, 'ML (mm)');
            ylabel(A.Ax, 'DV (mm)');
            xlim(A.Ax, [x0 x1]);
            ylim(A.Ax, [ybot ytop]);
            A.H = struct();

            % the section outline
            for k = 1:numel(A.Outline)
                r = A.Outline{k};
                A.H.outline(k) = plot(A.Ax, r([1:end 1], 1), r([1:end 1], 2), '-', ...
                    'Color', [0.3 0.3 0.3], 'LineWidth', 0.75, 'HitTest', 'off');
            end
            % the tracing: one line object per style, NaN-separated
            for style = {'solid', 'dashed'}
                P = A.Paths(strcmp({A.Paths.style}, style{1}));
                xy = zeros(0, 2);
                for k = 1:numel(P)
                    pts = P(k).pts;
                    if P(k).closed, pts(end+1, :) = pts(1, :); end %#ok<AGROW>
                    xy = [xy; A.pageToMm(pts); NaN NaN]; %#ok<AGROW>
                end
                if strcmp(style{1}, 'solid'), ls = '-'; else, ls = '--'; end
                A.H.(style{1}) = plot(A.Ax, xy(:, 1), xy(:, 2), ls, 'Color', [0.89 0 0.1], ...
                    'LineWidth', 0.9, 'HitTest', 'off');
            end
            % every region, faintly; the one in question, boldly
            if opts.Extents
                A.H.extents = gobjects(0);
                for k = 1:numel(A.Extents)
                    for j = 1:numel(A.Extents(k).rings)
                        r = A.Extents(k).rings{j};
                        A.H.extents(end+1) = patch(A.Ax, 'XData', r(:, 1), 'YData', r(:, 2), ...
                            'FaceColor', [0.2 0.5 0.9], 'FaceAlpha', 0.05, ...
                            'EdgeColor', [0.2 0.4 0.8], 'EdgeAlpha', 0.35, 'LineWidth', 0.5, ...
                            'UserData', A.Extents(k).abbr, 'HitTest', 'off');
                    end
                end
            end
            % the printed labels: a box each, and where a line is drawn, the line and its tip
            if opts.Labels && ~isempty(A.Labels)
                T = A.Labels;
                A.H.boxes = gobjects(0);
                for k = 1:height(T)
                    c = A.fracToMm(T.box_cx_frac(k), T.box_cy_frac(k));
                    wmm = T.box_w_frac(k) * A.Frame.width_px / A.Frame.ml_px_per_mm;
                    hmm = T.box_h_frac(k) * A.Frame.height_px / A.Frame.dv_px_per_mm;
                    A.H.boxes(end+1) = rectangle(A.Ax, 'Position', [c(1) - wmm/2, c(2) - hmm/2, wmm, hmm], ...
                        'EdgeColor', [0.9 0.7 0], 'LineWidth', 0.6, 'HitTest', 'off');
                    if T.has_line(k)
                        t = A.fracToMm(T.leader_tip_x_frac(k), T.leader_tip_y_frac(k));
                        plot(A.Ax, [c(1) t(1)], [c(2) t(2)], '-', 'Color', [0.9 0.7 0], ...
                            'LineWidth', 0.8, 'HitTest', 'off');
                        plot(A.Ax, t(1), t(2), 'o', 'MarkerSize', 4, 'MarkerEdgeColor', [0.7 0.5 0], ...
                            'MarkerFaceColor', [1 0.85 0.2], 'HitTest', 'off');
                    end
                end
            end
            A.highlight();
            A.redrawDraft();
            title(A.Ax, A.titleText(), 'Interpreter', 'none');
        end

        function setLayer(A, layer)
            % SETLAYER  Swap the plate image under the overlays: drawing, nissl, myelin or mri.
            A.Layer = char(layer);
            if isempty(A.Fig) || ~isvalid(A.Fig) || isempty(A.Img) || ~isvalid(A.Img)
                A.show();
                return
            end
            img = A.plateImage(A.Layer);
            [h, w, ~] = size(img);
            sx = A.Frame.width_px / w;
            sy = A.Frame.height_px / h;
            [x0, ytop] = A.plateToMm(0.5 * sx, 0.5 * sy);
            [x1, ybot] = A.plateToMm((w - 0.5) * sx, (h - 0.5) * sy);
            set(A.Img, 'CData', flipud(img), 'XData', [x0 x1], 'YData', [ybot ytop]);
            if ismatrix(img), colormap(A.Ax, gray(256)); end
        end

        function select(A, abbr)
            % SELECT  The region the correction is about; prints what the plate has for it.
            abbr = A.checkAbbr(abbr);
            A.Abbr = abbr;
            k = find(strcmp({A.Extents.abbr}, abbr));
            T = A.Labels(A.Labels.abbr == string(abbr), :);
            if isempty(k)
                fprintf('%s (%s): no area on plate %d today', abbr, A.nameOf(abbr), A.Plate);
            else
                e = A.Extents(k);
                fprintf('%s (%s) on plate %d: %.4f mm2 in %d ring(s), traced share %s%s', ...
                    abbr, e.name, A.Plate, e.area_mm2, numel(e.rings), mat2str(e.traced, 3), ...
                    AtlasRegionFix.iif(e.w, ' -- no outline of its own (w)', ''));
            end
            fprintf('; printed %d time(s)', height(T));
            for j = 1:height(T)
                fprintf('\n  box %d: ML %+.2f DV %+.2f%s', T.label_index(j), T.ml_mm(j), T.dv_mm(j), ...
                    AtlasRegionFix.iif(T.has_line(j), ' (at the end of its line)', ''));
            end
            fprintf('\n');
            if ~isempty(A.Fig) && isvalid(A.Fig)
                A.highlight();
                title(A.Ax, A.titleText(), 'Interpreter', 'none');
            end
        end

        function zoomTo(A, abbr, pad)
            % ZOOMTO  Frame a region, with `pad` mm around it (default 0.5).
            if nargin < 2 || isempty(abbr), abbr = A.Abbr; end
            if nargin < 3, pad = 0.5; end
            abbr = A.checkAbbr(abbr);
            A.ensureShown();
            k = find(strcmp({A.Extents.abbr}, abbr));
            if isempty(k)
                T = A.Labels(A.Labels.abbr == string(abbr), :);
                if isempty(T), error('AtlasRegionFix:zoom', '%s is neither drawn nor printed on plate %d', abbr, A.Plate); end
                xy = [T.ml_mm, T.dv_mm];
            else
                xy = vertcat(A.Extents(k).rings{:});
            end
            xlim(A.Ax, [min(xy(:, 1)) - pad, max(xy(:, 1)) + pad]);
            ylim(A.Ax, [min(xy(:, 2)) - pad, max(xy(:, 2)) + pad]);
        end
    end

    methods (Access = private)
        function ensureShown(A)
            if isempty(A.Fig) || ~isvalid(A.Fig) || isempty(A.Ax) || ~isvalid(A.Ax)
                A.show();
            end
        end

        function highlight(A)
            if ~isfield(A.H, 'extents'), return; end
            for h = A.H.extents(isvalid(A.H.extents))
                if ~isempty(A.Abbr) && strcmp(h.UserData, A.Abbr)
                    set(h, 'FaceAlpha', 0.25, 'EdgeAlpha', 1, 'LineWidth', 2, ...
                        'FaceColor', [0.1 0.7 0.2], 'EdgeColor', [0 0.5 0.1]);
                else
                    set(h, 'FaceAlpha', 0.05, 'EdgeAlpha', 0.35, 'LineWidth', 0.5, ...
                        'FaceColor', [0.2 0.5 0.9], 'EdgeColor', [0.2 0.4 0.8]);
                end
            end
            if isfield(A.H, 'abbrtext'), delete(A.H.abbrtext(isvalid(A.H.abbrtext))); end
            A.H.abbrtext = gobjects(0);
            if ~isempty(A.Abbr)
                T = A.Labels(A.Labels.abbr == string(A.Abbr), :);
                for j = 1:height(T)
                    c = A.fracToMm(T.box_cx_frac(j), T.box_cy_frac(j));
                    A.H.abbrtext(end+1) = text(A.Ax, c(1), c(2), sprintf(' %s[%d]', A.Abbr, T.label_index(j)), ...
                        'Color', [0.5 0.35 0], 'FontSize', 8, 'FontWeight', 'bold', ...
                        'VerticalAlignment', 'bottom', 'HitTest', 'off', 'Interpreter', 'none');
                end
            end
        end

        function redrawDraft(A)
            if isempty(A.Ax) || ~isvalid(A.Ax), return; end
            if isfield(A.H, 'draft') && isvalid(A.H.draft), delete(A.H.draft); end
            A.H.draft = hggroup(A.Ax);
            g = A.H.draft;
            for k = 1:numel(A.Draft.boundaries)
                b = A.Draft.boundaries{k};
                mm = A.pageToMm(b.page_px);
                if b.closed, mm(end+1, :) = mm(1, :); end %#ok<AGROW>
                line(mm(:, 1), mm(:, 2), 'Parent', g, 'Color', [0 0.65 0.8], 'LineWidth', 2.5, 'HitTest', 'off');
                line(mm([1 end], 1), mm([1 end], 2), 'Parent', g, 'LineStyle', 'none', 'Marker', 'o', ...
                    'Color', [0 0.65 0.8], 'MarkerSize', 6, 'HitTest', 'off');
            end
            for k = 1:numel(A.Draft.extents)
                e = A.Draft.extents{k};
                mm = A.pageToMm(e.page_px);
                patch('Parent', g, 'XData', mm(:, 1), 'YData', mm(:, 2), 'FaceColor', [0.8 0 0.8], ...
                    'FaceAlpha', 0.12, 'EdgeColor', [0.8 0 0.8], 'LineWidth', 2, 'HitTest', 'off');
            end
            for k = 1:numel(A.Draft.seeds)
                s = A.Draft.seeds{k};
                mm = A.pageToMm(s.page_px);
                if strcmp(s.kind, 'negative')
                    line(mm(1), mm(2), 'Parent', g, 'LineStyle', 'none', 'Marker', 'x', 'Color', [0.85 0.1 0.1], ...
                        'MarkerSize', 12, 'LineWidth', 2.5, 'HitTest', 'off');
                else
                    line(mm(1), mm(2), 'Parent', g, 'LineStyle', 'none', 'Marker', 'o', 'MarkerEdgeColor', 'w', ...
                        'MarkerFaceColor', [0.1 0.25 0.9], 'MarkerSize', 9, 'LineWidth', 1.5, 'HitTest', 'off');
                end
                text(mm(1), mm(2), sprintf('  %s', s.abbr), 'Parent', g, 'Color', [0.1 0.25 0.9], 'FontSize', 8, ...
                    'FontWeight', 'bold', 'HitTest', 'off', 'Interpreter', 'none');
            end
        end

        function t = titleText(A)
            t = sprintf('Plate %d, bregma %+.2f mm', A.Plate, A.Bregma);
            if ~isempty(A.Abbr), t = sprintf('%s  --  %s (%s)', t, A.Abbr, A.nameOf(A.Abbr)); end
            n = [numel(A.Draft.seeds), numel(A.Draft.boundaries), numel(A.Draft.extents)];
            if any(n), t = sprintf('%s  [%d seed, %d boundary, %d extent]', t, n); end
        end

        function abbr = checkAbbr(A, abbr)
            abbr = char(string(abbr));
            if isempty(abbr), error('AtlasRegionFix:abbr', 'name a region: A.select(''S1DZ'')'); end
            if ~any(A.Structures.abbr == string(abbr))
                near = A.Structures.abbr(contains(lower(A.Structures.abbr), lower(abbr)));
                error('AtlasRegionFix:abbr', 'no structure is abbreviated %s%s', abbr, ...
                    AtlasRegionFix.iif(isempty(near), '', [' -- did you mean ' strjoin(cellstr(near(1:min(8, end))), ', ') '?']));
            end
        end

        function n = nameOf(A, abbr)
            n = char(A.Structures.name(A.Structures.abbr == string(abbr)));
        end
    end

    % ================================================================ marking
    methods
        function problem(A, text)
            % PROBLEM  One or two sentences on what is wrong: what Claude reads first.
            A.Draft.problem = char(string(text));
            A.touch();
        end

        function note(A, text)
            % NOTE  Anything else worth saying; timestamped.
            when = char(datetime('now', 'TimeZone', 'UTC', 'Format', 'yyyy-MM-dd HH:mm'));
            A.Draft.notes{end+1} = sprintf('%s  %s', when, char(string(text)));
        end

        function hemisphere(A, side)
            % HEMISPHERE  'left', 'right' or 'both'; otherwise read off the seeds at commit.
            A.Draft.hemisphere = char(string(side));
        end

        function s = addSeed(A, abbr, mm, opts)
            % ADDSEED  A point that is (or is not) inside a region.
            %   A.addSeed('S1DZ')                 click it on the figure
            %   A.addSeed('S1DZ', [-4.13 -2.88])  ML, DV in mm
            %   'Kind'     'positive' (default) or 'negative': this point is not S1DZ
            %   'Replaces' the index of a printed box of that name (as shown: S1DZ[0]) whose
            %              seed this one stands in for. Without it the seed is added beside
            %              the printed ones; use it when the printed box seeds the wrong face.
            %   'Note'     why
            arguments
                A
                abbr (1,1) string = string(A.Abbr)
                mm double = []
                opts.Kind (1,1) string = "positive"
                opts.Replaces double = []
                opts.Note (1,1) string = ""
            end
            abbr = A.checkAbbr(abbr);
            kind = lower(char(opts.Kind));
            if ~ismember(kind, {'positive', 'negative'}), error('AtlasRegionFix:kind', 'Kind is positive or negative'); end
            if isempty(mm)
                A.ensureShown();
                fprintf('Click where %s is%s\n', abbr, AtlasRegionFix.iif(strcmp(kind, 'negative'), ' not', ''));
                r = drawpoint(A.Ax, 'Color', [0.1 0.25 0.9]);
                if ~isvalid(r) || isempty(r.Position), return; end
                mm = r.Position;
                delete(r);
            end
            mm = reshape(mm, 1, 2);
            s = struct('abbr', abbr, 'kind', kind, 'page_px', round(A.mmToPage(mm), 2), ...
                'mm', round(mm, 3), 'note', char(opts.Note));
            if ~isempty(opts.Replaces)
                T = A.Labels(A.Labels.abbr == string(abbr), :);
                if ~any(T.label_index == opts.Replaces)
                    error('AtlasRegionFix:replaces', '%s has box(es) %s on plate %d, not %d', ...
                        abbr, mat2str(T.label_index'), A.Plate, opts.Replaces);
                end
                s.label_index = opts.Replaces;
            end
            A.Draft.seeds{end+1} = s;
            fprintf('seed %d: %s %s at ML %+.3f DV %+.3f (page %.0f, %.0f)\n', numel(A.Draft.seeds), ...
                abbr, kind, mm(1), mm(2), s.page_px(1), s.page_px(2));
            A.touch();
        end

        function b = addBoundary(A, mm, opts)
            % ADDBOUNDARY  A run of boundary the tracing missed.
            %   A.addBoundary()                  draw it: click the vertices, double-click to finish
            %   A.addBoundary(mm)                an N x 2 list of [ML DV]
            %   'Style'    'solid' (default) or 'dashed', as the atlas prints the line
            %   'Closed'   true for a ring
            %   'Snap'     pull each end onto the nearest traced point within this many page px
            %              (default 20, the distance the pipeline bridges); 0 to leave them
            %   'Freehand' true to draw with the mouse held down instead of clicking vertices
            %   'Note'     why
            arguments
                A
                mm double = []
                opts.Style (1,1) string = "solid"
                opts.Closed (1,1) logical = false
                opts.Snap (1,1) double = AtlasRegionFix.BridgePx
                opts.Freehand (1,1) logical = false
                opts.Note (1,1) string = ""
            end
            style = lower(char(opts.Style));
            if ~ismember(style, {'solid', 'dashed'}), error('AtlasRegionFix:style', 'Style is solid or dashed'); end
            if isempty(mm)
                A.ensureShown();
                if opts.Freehand
                    fprintf('Draw the missing boundary with the mouse held down\n');
                    r = drawfreehand(A.Ax, 'Color', [0 0.65 0.8], 'Closed', opts.Closed);
                else
                    fprintf('Click along the missing boundary; double-click the last vertex\n');
                    if opts.Closed
                        r = drawpolygon(A.Ax, 'Color', [0 0.65 0.8]);
                    else
                        r = drawpolyline(A.Ax, 'Color', [0 0.65 0.8]);
                    end
                end
                if ~isvalid(r) || size(r.Position, 1) < 2, return; end
                mm = r.Position;
                delete(r);
                if opts.Freehand
                    % a freehand stroke is hundreds of points a hair apart; keep the shape
                    xy = A.mmToPage(mm);
                    xy = reducepoly(xy, 0.002);
                    mm = A.pageToMm(xy);
                end
            end
            if size(mm, 2) ~= 2 || size(mm, 1) < 2, error('AtlasRegionFix:boundary', 'a boundary is N x 2 [ML DV], N >= 2'); end
            xy = A.mmToPage(mm);
            if opts.Snap > 0 && ~opts.Closed
                P = A.tracingPoints();
                for e = [1, size(xy, 1)]
                    d = hypot(P(:, 1) - xy(e, 1), P(:, 2) - xy(e, 2));
                    [dm, j] = min(d);
                    if dm <= opts.Snap
                        xy(e, :) = P(j, :);
                    else
                        warning('AtlasRegionFix:snap', ['an end of the boundary is %.0f page px from the nearest traced ' ...
                            'line, beyond the %d the pipeline bridges: it will not seal a face'], dm, AtlasRegionFix.BridgePx);
                    end
                end
            end
            b = struct('style', style, 'closed', opts.Closed, 'page_px', round(xy, 2), ...
                'mm', round(A.pageToMm(xy), 3), 'note', char(opts.Note));
            A.Draft.boundaries{end+1} = b;
            L = sum(hypot(diff(xy(:, 1)), diff(xy(:, 2))));
            fprintf('boundary %d: %s, %d points, %.0f page px (%.2f mm)\n', numel(A.Draft.boundaries), ...
                style, size(xy, 1), L, L * A.mmPerPagePx());
            A.touch();
        end

        function e = addExtent(A, abbr, mm, opts)
            % ADDEXTENT  The outline a region should have.
            %   A.addExtent('S1DZ')              the region's own ring appears as an editable
            %                                    polygon: drag its vertices, add or delete them,
            %                                    then double-click it to accept
            %   A.addExtent('S1DZ', mm)          an N x 2 ring of [ML DV]
            %   'Hemisphere'  'left' or 'right': which of the region's rings to start from
            %   'Note'        why
            % The extents are re-cut by the pipeline, never copied: what a ring here says
            % is where the boundary runs, and the parts of it off the traced ink are what
            % get traced.
            arguments
                A
                abbr (1,1) string = string(A.Abbr)
                mm double = []
                opts.Hemisphere (1,1) string = ""
                opts.Note (1,1) string = ""
            end
            abbr = A.checkAbbr(abbr);
            if isempty(mm)
                A.ensureShown();
                k = find(strcmp({A.Extents.abbr}, abbr));
                start = [];
                if ~isempty(k)
                    rings = A.Extents(k).rings;
                    side = lower(char(opts.Hemisphere));
                    if ~isempty(side)
                        keep = cellfun(@(r) AtlasRegionFix.iif(strcmp(side, 'left'), mean(r(:, 1)) < 0, mean(r(:, 1)) >= 0), rings);
                        rings = rings(keep);
                    end
                    if ~isempty(rings)
                        [~, j] = max(cellfun(@(r) polyarea(r(:, 1), r(:, 2)), rings));
                        start = rings{j};
                    end
                end
                if isempty(start)
                    fprintf('%s has no ring here to start from: click the outline, double-click the last vertex\n', abbr);
                    r = drawpolygon(A.Ax, 'Color', [0.8 0 0.8]);
                else
                    fprintf('Drag the vertices of %s into place (right-click a vertex to delete it, click an edge to add one), then double-click the polygon\n', abbr);
                    r = images.roi.Polygon(A.Ax, 'Position', start, 'Color', [0.8 0 0.8]);
                    wait(r);
                end
                if ~isvalid(r) || size(r.Position, 1) < 3, return; end
                mm = r.Position;
                delete(r);
            end
            if size(mm, 2) ~= 2 || size(mm, 1) < 3, error('AtlasRegionFix:extent', 'an extent is N x 2 [ML DV], N >= 3'); end
            if isequal(mm(1, :), mm(end, :)), mm(end, :) = []; end
            xy = A.mmToPage(mm);
            e = struct('abbr', abbr, 'page_px', round(xy, 2), 'mm', round(A.pageToMm(xy), 3), 'note', char(opts.Note));
            A.Draft.extents{end+1} = e;
            fprintf('extent %d: %s, %d vertices, %.4f mm2\n', numel(A.Draft.extents), abbr, size(xy, 1), polyarea(mm(:, 1), mm(:, 2)));
            A.touch();
        end

        function undo(A)
            % UNDO  Drop the last mark made.
            n = [numel(A.Draft.seeds), numel(A.Draft.boundaries), numel(A.Draft.extents)];
            if ~any(n), fprintf('nothing to undo\n'); return; end
            % the most recent is whichever list grew last; keep it simple and ask
            kinds = {'seeds', 'boundaries', 'extents'};
            k = find(n, 1, 'last');
            A.Draft.(kinds{k})(end) = [];
            fprintf('dropped the last of %s\n', kinds{k});
            A.touch();
        end

        function clear(A)
            % CLEAR  Drop every mark; keep the problem text.
            A.Draft.seeds = {};
            A.Draft.boundaries = {};
            A.Draft.extents = {};
            A.touch();
        end
    end

    methods (Access = private)
        function touch(A)
            A.Faces = [];
            A.redrawDraft();
            if ~isempty(A.Ax) && isvalid(A.Ax), title(A.Ax, A.titleText(), 'Interpreter', 'none'); end
        end

        function P = tracingPoints(A)
            P = vertcat(A.Paths.pts);
            for k = 1:numel(A.Outline)
                P = [P; A.mmToPage(A.Outline{k})]; %#ok<AGROW>
            end
        end

        function s = mmPerPagePx(A)
            m = A.M;
            det = abs(m(1) * m(4) - m(2) * m(3));
            s = sqrt(det / (A.Frame.ml_px_per_mm * A.Frame.dv_px_per_mm));
        end
    end

    % ================================================================ preview
    methods
        function rep = preview(A, opts)
            % PREVIEW  What the extraction would make of the draft, without Python.
            %   Rasterizes the tracing, the outline and the draft boundaries on the page
            %   the way build_region_extents.py does (steps 1-4: ink, bridged ends,
            %   section interior, faces), then says for every seed which face it lands
            %   in, how big the face is, which printed labels seed the same face -- a
            %   face two names share is split by the watershed, one name keeps the
            %   whole -- and who owns the point today; and for every boundary how far
            %   its ends sit from the ink. 'Overlay' (default true) paints the seeds'
            %   faces on the figure.
            arguments
                A
                opts.Overlay (1,1) logical = true
            end
            F = A.faceMap();
            rep = struct('seeds', {{}}, 'boundaries', {{}}, 'extents', {{}});
            fprintf('plate %d, %s: %d faces of %d page px or more\n', A.Plate, A.Abbr, sum(F.fsize >= A.MinFacePx), A.MinFacePx);
            if isempty(A.Draft.seeds) && isempty(A.Draft.boundaries) && isempty(A.Draft.extents)
                fprintf('  nothing marked yet\n');
            end
            if opts.Overlay
                A.ensureShown();
                if isfield(A.H, 'faces') && isvalid(A.H.faces), delete(A.H.faces); end
                A.H.faces = hggroup(A.Ax);
            end
            L = A.labelSeeds();
            for k = 1:numel(A.Draft.seeds)
                s = A.Draft.seeds{k};
                xi = round(s.page_px(1)) + 1;
                yi = round(s.page_px(2)) + 1;
                r = struct('abbr', s.abbr, 'kind', s.kind, 'face', 0, 'face_px', 0, 'face_mm2', 0, ...
                    'names', {{}}, 'owner', A.ownerAt(s.mm), 'inside', false);
                if xi >= 1 && xi <= F.W && yi >= 1 && yi <= F.H
                    r.inside = F.interior(yi, xi);
                    r.face = F.faces(yi, xi);
                end
                if r.face > 0
                    r.face_px = F.fsize(r.face);
                    r.face_mm2 = r.face_px * A.mmPerPagePx()^2;
                    r.names = unique(L.abbr(L.face == r.face))';
                end
                rep.seeds{end+1} = r;
                where = 'outside the section';
                if r.inside && r.face == 0, where = 'on a traced line'; end
                if r.face > 0
                    where = sprintf('in a face of %d px (%.3f mm2) that %s seeds', r.face_px, r.face_mm2, ...
                        AtlasRegionFix.iif(isempty(r.names), 'no printed label', strjoin(cellstr(r.names), ', ')));
                end
                fprintf('  seed %d %s %s at ML %+.2f DV %+.2f: %s; today %s\n', k, s.abbr, s.kind, s.mm(1), s.mm(2), where, ...
                    AtlasRegionFix.iif(isempty(r.owner), 'in no region', ['inside ' r.owner]));
                if strcmp(s.kind, 'positive') && r.face > 0
                    if any(strcmp(r.names, s.abbr))
                        fprintf('    -> %s already seeds this face; if it comes out wrong, a boundary leaks\n', s.abbr);
                    elseif numel(r.names) == 1
                        fprintf('    -> the atlas letters this face %s alone: a seed here would split it -- look for a boundary the tracing missed\n', r.names(1));
                    elseif isempty(r.names)
                        fprintf('    -> an unlettered face: the seed names it\n');
                    else
                        fprintf('    -> a face several names share: the seed joins the split\n');
                    end
                end
                if opts.Overlay && r.face > 0
                    B = bwboundaries(F.faces == r.face, 4, 'noholes');
                    for j = 1:numel(B)
                        ring = A.pageToMm([B{j}(:, 2) - 1, B{j}(:, 1) - 1]);
                        patch('Parent', A.H.faces, 'XData', ring(:, 1), 'YData', ring(:, 2), 'FaceColor', ...
                            AtlasRegionFix.iif(strcmp(s.kind, 'negative'), [0.9 0.2 0.2], [0.1 0.3 0.9]), ...
                            'FaceAlpha', 0.2, 'EdgeColor', 'none', 'HitTest', 'off');
                    end
                end
            end
            P = A.tracingPoints();
            for k = 1:numel(A.Draft.boundaries)
                b = A.Draft.boundaries{k};
                xy = b.page_px;
                d = zeros(1, 2);
                for e = 1:2
                    q = xy(AtlasRegionFix.iif(e == 1, 1, size(xy, 1)), :);
                    d(e) = min(hypot(P(:, 1) - q(1), P(:, 2) - q(2)));
                end
                rep.boundaries{end+1} = struct('style', b.style, 'end_dist_px', d);
                fprintf('  boundary %d (%s): ends %.1f and %.1f page px from traced ink -> %s\n', k, b.style, d, ...
                    AtlasRegionFix.iif(all(d <= A.BridgePx), 'the pipeline seals it', 'an end is beyond BRIDGE_PX and will not seal'));
            end
            for k = 1:numel(A.Draft.extents)
                e = A.Draft.extents{k};
                xy = e.page_px;
                s = AtlasRegionFix.sampleRing(xy);
                off = A.offInk(F.dist, s);
                rep.extents{end+1} = struct('abbr', e.abbr, 'vertices', size(xy, 1), 'off_ink', mean(off));
                fprintf('  extent %d (%s): %d vertices; %.0f%% of its outline is off the traced ink -- that part is what gets traced\n', ...
                    k, e.abbr, size(xy, 1), 100 * mean(off));
            end
        end
    end

    methods (Access = private)
        function F = faceMap(A)
            % The page raster: ink, bridged ends, interior, faces -- as the pipeline cuts them.
            if ~isempty(A.Faces), F = A.Faces; return; end
            W = A.Page.W;
            H = A.Page.H;
            wall = false(H, W);
            allpts = zeros(0, 2);
            id = zeros(0, 1);
            open = zeros(0, 2);    % [path index, point index] of every dangling end
            n = 0;
            for k = 1:numel(A.Paths)
                pts = A.Paths(k).pts;
                if A.Paths(k).closed
                    pts(end+1, :) = pts(1, :); %#ok<AGROW>
                else
                    open(end+1, :) = [k, 1]; %#ok<AGROW>
                    open(end+1, :) = [k, size(pts, 1)]; %#ok<AGROW>
                end
                wall = AtlasRegionFix.paint(wall, pts);
                n = n + 1;
                allpts = [allpts; A.Paths(k).pts]; %#ok<AGROW>
                id = [id; repmat(n, size(A.Paths(k).pts, 1), 1)]; %#ok<AGROW>
            end
            sect = false(H, W);
            for k = 1:numel(A.Outline)
                pts = A.mmToPage(A.Outline{k});
                pts(end+1, :) = pts(1, :); %#ok<AGROW>
                wall = AtlasRegionFix.paint(wall, pts);
                sect = AtlasRegionFix.paint(sect, pts);
                n = n + 1;
                allpts = [allpts; pts]; %#ok<AGROW>
                id = [id; repmat(n, size(pts, 1), 1)]; %#ok<AGROW>
            end
            % The section outline counts as ink the atlas drew, which is why the pipeline
            % rasterises it into `traced` before it copies `wall` off it. Taking the copy
            % a loop earlier left offInk() measuring an extent that runs along the brain
            % surface as entirely off the ink, where the pipeline scores that boundary as
            % drawn. The bridges and any drafted boundary stay out: neither is ink the
            % tracing drew.
            traced = wall;
            % the draft boundaries are ink too
            for k = 1:numel(A.Draft.boundaries)
                b = A.Draft.boundaries{k};
                pts = b.page_px;
                if b.closed
                    pts(end+1, :) = pts(1, :); %#ok<AGROW>
                else
                    open(end+1, :) = [-k, 1]; %#ok<AGROW>
                    open(end+1, :) = [-k, size(pts, 1)]; %#ok<AGROW>
                end
                wall = AtlasRegionFix.paint(wall, pts);
                n = n + 1;
                allpts = [allpts; pts]; %#ok<AGROW>
                id = [id; repmat(n, size(pts, 1), 1)]; %#ok<AGROW>
            end
            % Bridge the dangling ends to the nearest point on another path within
            % BridgePx. One residue lives here and is not closeable from MATLAB: where
            % two points on different paths are exactly equidistant from an endpoint,
            % the pipeline takes whichever cKDTree's traversal hands back first and this
            % takes the lowest index, and integer coordinates make exact ties common
            % enough to matter -- 1,993 of the atlas's 17,872 open endpoints have one,
            % 59 of them inside BridgePx. It comes to five endpoints over the 62 plates
            % where the two rules pick different points, and one of those changes a face:
            % on plate 34 the endpoint at (1083, 1331) has two candidates 9*sqrt(2) away,
            % and the bridge the pipeline draws seals Or off from GrDG and MoDG where the
            % one drawn here does not. Four printed labels of 6,337, all on that plate.
            % Matching it would mean reimplementing scipy's traversal order; the honest
            % alternative is to say where it bites.
            for e = 1:size(open, 1)
                k = open(e, 1);
                if k > 0, pts = A.Paths(k).pts; else, pts = A.Draft.boundaries{-k}.page_px; end
                q = pts(open(e, 2), :);
                own = A.pathNumber(k);
                d = hypot(allpts(:, 1) - q(1), allpts(:, 2) - q(2));
                d(id == own) = inf;
                [dm, j] = min(d);
                if dm > 0 && dm <= A.BridgePx
                    wall = AtlasRegionFix.paint(wall, [q; allpts(j, :)]);
                end
            end
            interior = imfill(sect, 'holes');
            faces = bwlabel(~wall & interior, 4);
            fsize = accumarray(faces(faces > 0), 1);
            F = struct('W', W, 'H', H, 'traced', traced, 'wall', wall, 'interior', interior, ...
                'faces', faces, 'fsize', fsize, 'dist', bwdist(traced));
            A.Faces = F;
        end

        function n = pathNumber(A, k)
            % the running number faceMap gave path k (>0) or draft boundary -k
            if k > 0, n = k; else, n = numel(A.Paths) + numel(A.Outline) - k; end
        end

        function L = labelSeeds(A)
            % Every printed label of the plate as the pipeline seeds it -- the end of its
            % line where the atlas draws one, else the word -- and the face that lands in.
            F = A.faceMap();
            T = A.Labels;
            fx = T.box_cx_frac;
            fy = T.box_cy_frac;
            fx(T.has_line) = T.leader_tip_x_frac(T.has_line);
            fy(T.has_line) = T.leader_tip_y_frac(T.has_line);
            [x, y] = A.plateToPage(fx * A.Frame.width_px, fy * A.Frame.height_px);
            xi = AtlasRegionFix.roundeven(x) + 1;
            yi = AtlasRegionFix.roundeven(y) + 1;
            face = zeros(height(T), 1);
            ok = xi >= 1 & xi <= F.W & yi >= 1 & yi <= F.H;
            face(ok) = F.faces(sub2ind(size(F.faces), yi(ok), xi(ok)));
            L = table(T.abbr, T.label_index, face, 'VariableNames', {'abbr', 'index', 'face'});
        end

        function ab = ownerAt(A, mm)
            % Which region's extent holds a point today, even-odd over its rings.
            ab = '';
            for k = 1:numel(A.Extents)
                c = 0;
                for j = 1:numel(A.Extents(k).rings)
                    r = A.Extents(k).rings{j};
                    c = c + inpolygon(mm(1), mm(2), r(:, 1), r(:, 2));
                end
                if mod(c, 2) == 1, ab = A.Extents(k).abbr; return; end
            end
        end

        function off = offInk(A, dist, s)
            xi = AtlasRegionFix.roundeven(s(:, 1)) + 1;
            yi = AtlasRegionFix.roundeven(s(:, 2)) + 1;
            off = true(size(xi));
            ok = xi >= 1 & xi <= size(dist, 2) & yi >= 1 & yi <= size(dist, 1);
            off(ok) = dist(sub2ind(size(dist), yi(ok), xi(ok))) > A.SupportPx;
        end
    end

    methods (Static, Access = private)
        function mask = paint(mask, pts)
            % A polyline as a one-pixel, eight-connected wall, stepped exactly as
            % build_region_extents.rasterize steps it: max(|dx|, |dy|) + 1 samples per
            % segment, each rounded onto the lattice (page px are 0-based; the array is
            % not). The step has to be that one and not something finer. Sampling the
            % whole polyline every half pixel instead lays down a wall 16% thicker --
            % 30,037 page px against 25,780 on plate 19 -- which eats into every face
            % and drops two of them under MIN_FACE_PX, so preview() answers 81 faces and
            % a 4,558 px face where the pipeline has 83 and 4,608.
            %
            % Rounded the way Python rounds, which is not the way MATLAB does -- see
            % roundeven(). A half has to break to the even neighbour or the wall parts
            % company with the pipeline's on the plates where it matters.
            for i = 1:size(pts, 1) - 1
                d = pts(i+1, :) - pts(i, :);
                n = floor(max(abs(d))) + 1;
                t = (0:n)' / n;
                xi = AtlasRegionFix.roundeven(pts(i, 1) + d(1) * t) + 1;
                yi = AtlasRegionFix.roundeven(pts(i, 2) + d(2) * t) + 1;
                ok = xi >= 1 & xi <= size(mask, 2) & yi >= 1 & yi <= size(mask, 1);
                mask(sub2ind(size(mask), yi(ok), xi(ok))) = true;
            end
        end

        function r = roundeven(v)
            % Python's round(), which breaks a half to the even neighbour where MATLAB's
            % breaks it away from zero. Every page coordinate that lands on the lattice
            % goes through this, because the difference is not cosmetic: `rasterize`
            % walks x0 + dx*k/n, so a segment between integer endpoints with an even n
            % puts a sample on exactly .5, and .5, .25 and .75 are binary-exact -- the
            % tie is real, not a float artefact. 7,382 of the 5.17 million coordinates
            % rounded over the 62 plates are exact halves.
            %
            % One of them is the midpoint of the (1267,1162)-(1266,1163) bridge on plate
            % 33. Breaking it away from zero takes the other corner of that diagonal,
            % which leaves the bridge 8-connected instead of 4-connected, and the wall
            % it was drawn to seal simply opens: the face that should be {MGD, SG} comes
            % back as {MGD, Po, PoT, SG}. Thirteen printed labels over plates 33, 34 and
            % 39 land in a face with a different name-set on that one rule, which is
            % preview() giving the wrong answer rather than an approximate one.
            r = round(v);
            tie = abs(v - fix(v)) == 0.5;
            r(tie) = 2 * round(v(tie) / 2);
        end

        function s = sampleRing(pts, closed)
            % Points every half page pixel along a polyline (closed: back to the start).
            if nargin < 2, closed = true; end
            if closed && ~isequal(pts(1, :), pts(end, :)), pts(end+1, :) = pts(1, :); end
            seg = hypot(diff(pts(:, 1)), diff(pts(:, 2)));
            keep = [true; seg > 0];
            pts = pts(keep, :);
            if size(pts, 1) < 2, s = pts; return; end
            t = [0; cumsum(hypot(diff(pts(:, 1)), diff(pts(:, 2))))];
            q = (0:0.5:t(end))';
            if q(end) < t(end), q(end+1) = t(end); end
            s = [interp1(t, pts(:, 1), q), interp1(t, pts(:, 2), q)];
        end
    end

    % ================================================================ the document
    methods
        function c = toStruct(A)
            % TOSTRUCT  The correction as it will be written: schema gerbil-atlas-correction/1.
            c = struct();
            c.schema = A.Schema;
            c.id = A.makeId();
            c.created = char(datetime('now', 'TimeZone', 'UTC', 'Format', 'yyyy-MM-dd''T''HH:mm:ss''Z'''));
            c.author = A.authorName();
            c.plate = A.Plate;
            c.ap_bregma_mm = A.Bregma;
            c.abbr = A.Abbr;
            c.hemisphere = A.hemisphereOf();
            c.problem = A.Draft.problem;
            c.seeds = A.Draft.seeds;
            c.boundaries = cellfun(@AtlasRegionFix.pointsAsCells, A.Draft.boundaries, 'UniformOutput', false);
            c.extents = cellfun(@AtlasRegionFix.pointsAsCells, A.Draft.extents, 'UniformOutput', false);
            c.notes = A.Draft.notes;
            c.snapshot = [];
            c.source = struct('commit', A.Commit, 'site', A.Site, 'repo', A.Repo, ...
                'tool', ['AtlasRegionFix ' A.Version], 'matlab', version);
        end

        function txt = toJSON(A)
            % TOJSON  The correction as text.
            txt = jsonencode(A.toStruct(), 'PrettyPrint', true);
        end

        function save(A, file)
            % SAVE  The draft to a JSON file, to come back to with AtlasRegionFix.load(file).
            AtlasRegionFix.writeText(file, A.toJSON());
            fprintf('saved %s\n', file);
        end

        function r = commit(A, opts)
            % COMMIT  Write the correction and send it.
            %   With a clone ('Repo'): a branch correction/<id> is cut from origin/main in a
            %   temporary worktree, the file (and a snapshot of the figure) committed there
            %   and pushed; your own checkout is not touched. Without one: the same commit
            %   is made through the GitHub API with a token ('Token', or GITHUB_TOKEN in
            %   the environment). Either way the push starts the workflow that applies it.
            %   'Message'   the commit title (default: "Correction: <abbr> on plate NN")
            %   'Branch'    the branch (default correction/<id>)
            %   'Snapshot'  also commit a PNG of the figure (default true)
            %   'DryRun'    write the file next to the cache and stop
            arguments
                A
                opts.Message (1,1) string = ""
                opts.Branch (1,1) string = ""
                opts.Snapshot (1,1) logical = true
                opts.DryRun (1,1) logical = false
            end
            A.validateDraft();
            c = A.toStruct();
            id = c.id;
            branch = char(opts.Branch);
            if isempty(branch), branch = ['correction/' id]; end
            title_ = char(opts.Message);
            if isempty(title_), title_ = sprintf('Correction: %s on plate %d', A.Abbr, A.Plate); end
            png = [];
            if opts.Snapshot && ~isempty(A.Fig) && isvalid(A.Fig)
                tmp = [tempname '.png'];
                exportgraphics(A.Ax, tmp, 'Resolution', 150);
                png = AtlasRegionFix.readBytes(tmp);
                delete(tmp);
                c.snapshot = sprintf('corrections/%s.png', id);
            end
            json = jsonencode(c, 'PrettyPrint', true);
            body = sprintf('%s\n\nCorrection-Id: %s', c.problem, id);
            r = struct('id', id, 'branch', branch, 'json', json);
            if opts.DryRun
                out = fullfile(A.CacheDir, 'corrections');
                if ~isfolder(out), mkdir(out); end
                AtlasRegionFix.writeText(fullfile(out, [id '.json']), json);
                fprintf('dry run: wrote %s\n', fullfile(out, [id '.json']));
                if ~isempty(png)
                    AtlasRegionFix.writeBytes(fullfile(out, [id '.png']), png);
                    fprintf('           and %s\n', fullfile(out, [id '.png']));
                end
                fprintf('nothing was pushed; drop DryRun to send it\n');
                r.path = fullfile(out, [id '.json']);
                return
            end
            if ~isempty(A.Repo)
                A.commitWithGit(id, branch, json, png, title_, body);
            else
                A.commitWithApi(id, branch, json, png, title_, body);
            end
            base = sprintf('https://github.com/%s/%s', A.Owner, A.RepoName);
            r.url = sprintf('%s/tree/%s', base, branch);
            fprintf('pushed %s\n  branch:   %s\n  workflow: %s/actions/workflows/apply-correction.yml\n  pulls:    %s/pulls\n', ...
                id, r.url, base, base);
        end

        function report(A)
            % REPORT  What has been marked so far.
            fprintf('%s\n', A.titleText());
            fprintf('  problem: %s\n', AtlasRegionFix.iif(isempty(A.Draft.problem), '(none yet)', A.Draft.problem));
            for k = 1:numel(A.Draft.seeds)
                s = A.Draft.seeds{k};
                fprintf('  seed %d: %s %s at ML %+.3f DV %+.3f%s %s\n', k, s.abbr, s.kind, s.mm(1), s.mm(2), ...
                    AtlasRegionFix.iif(isfield(s, 'label_index'), sprintf(' (stands in for box %d)', s.label_index), ''), s.note);
            end
            for k = 1:numel(A.Draft.boundaries)
                b = A.Draft.boundaries{k};
                fprintf('  boundary %d: %s, %d points %s\n', k, b.style, size(b.page_px, 1), b.note);
            end
            for k = 1:numel(A.Draft.extents)
                e = A.Draft.extents{k};
                fprintf('  extent %d: %s, %d vertices %s\n', k, e.abbr, size(e.page_px, 1), e.note);
            end
            for k = 1:numel(A.Draft.notes)
                fprintf('  note: %s\n', A.Draft.notes{k});
            end
        end
    end

    methods (Static)
        function A = load(file, varargin)
            % LOAD  A draft saved with save(), or any correction file, back into an object.
            %   Name-value arguments are passed to the constructor ('Repo', 'Site', ...).
            c = jsondecode(fileread(file));
            A = AtlasRegionFix(c.plate, varargin{:});
            if isfield(c, 'abbr') && ~isempty(c.abbr), A.Abbr = char(c.abbr); end
            if isfield(c, 'problem') && ~isempty(c.problem), A.Draft.problem = char(c.problem); end
            if isfield(c, 'hemisphere') && ~isempty(c.hemisphere), A.Draft.hemisphere = char(c.hemisphere); end
            A.Draft.seeds = AtlasRegionFix.asCells(c, 'seeds', @(s) AtlasRegionFix.seedIn(A, s));
            A.Draft.boundaries = AtlasRegionFix.asCells(c, 'boundaries', @(b) AtlasRegionFix.polyIn(A, b, 'boundary'));
            A.Draft.extents = AtlasRegionFix.asCells(c, 'extents', @(e) AtlasRegionFix.polyIn(A, e, 'extent'));
            if isfield(c, 'notes') && ~isempty(c.notes)
                A.Draft.notes = cellstr(string(c.notes))';
            end
            fprintf('loaded %s: plate %d, %s, %d seed(s), %d boundary(ies), %d extent(s)\n', file, A.Plate, A.Abbr, ...
                numel(A.Draft.seeds), numel(A.Draft.boundaries), numel(A.Draft.extents));
        end

        function P = parseSvg(txt)
            % PARSESVG  The <path> elements of a traced plate, by group, flattened to page px.
            P = struct('d', {}, 'style', {}, 'closed', {}, 'pts', {}, 'stroke', {}, 'dash', {});
            groups = regexp(txt, '<g id="([^"]+)"[^>]*>(.*?)</g>', 'tokens');
            for g = 1:numel(groups)
                gid = groups{g}{1};
                body = groups{g}{2};
                style = 'solid';
                if contains(gid, 'dashed'), style = 'dashed'; end
                paths = regexp(body, '<path\s+d="([^"]+)"([^>]*)>', 'tokens');
                for k = 1:numel(paths)
                    d = paths{k}{1};
                    attrs = paths{k}{2};
                    [pts, closed] = AtlasRegionFix.flatten(d);
                    if size(pts, 1) < 2, continue; end
                    sw = regexp(attrs, 'stroke-width="([^"]+)"', 'tokens', 'once');
                    da = regexp(attrs, 'stroke-dasharray="([^"]+)"', 'tokens', 'once');
                    stroke = 1;
                    if ~isempty(sw), stroke = str2double(sw{1}); end
                    dash = '';
                    if ~isempty(da), dash = da{1}; end
                    P(end+1) = struct('d', d, 'style', style, 'closed', closed, 'pts', pts, ...
                        'stroke', stroke, 'dash', dash); %#ok<AGROW>
                end
            end
        end

        function [pts, closed] = flatten(d)
            % FLATTEN  An M/C/Z path (absolute, as the tracer writes it) to a polyline, the
            % cubics cut as build_region_extents.flatten cuts them -- same chord, same
            % segment count -- so a preview raster here is the raster there to within the
            % rounding note in paint(). L is read too, for the app's own SVG exports.
            toks = regexp(d, '[MLCZmlcz]|-?\d*\.?\d+(?:e-?\d+)?', 'match');
            pts = zeros(0, 2);
            closed = false;
            cmd = '';
            cur = [0 0];
            i = 1;
            while i <= numel(toks)
                t = toks{i};
                if any(strcmp(t, {'M', 'L', 'C', 'Z', 'm', 'l', 'c', 'z'}))
                    cmd = upper(t);
                    i = i + 1;
                    if cmd == 'Z', closed = true; end
                    continue
                end
                switch cmd
                    case 'M'
                        cur = [str2double(toks{i}), str2double(toks{i+1})];
                        pts(end+1, :) = cur; %#ok<AGROW>
                        i = i + 2;
                        cmd = 'L';
                    case 'L'
                        cur = [str2double(toks{i}), str2double(toks{i+1})];
                        pts(end+1, :) = cur; %#ok<AGROW>
                        i = i + 2;
                    case 'C'
                        p0 = cur;
                        p1 = [str2double(toks{i}), str2double(toks{i+1})];
                        p2 = [str2double(toks{i+2}), str2double(toks{i+3})];
                        p3 = [str2double(toks{i+4}), str2double(toks{i+5})];
                        i = i + 6;
                        chord = norm(p1 - p0) + norm(p2 - p1) + norm(p3 - p2);
                        n = max(2, min(32, floor(chord / 3) + 2));
                        u = (1:n)' / n;
                        w = 1 - u;
                        pts = [pts; w.^3 * p0 + 3 * w.^2 .* u * p1 + 3 * w .* u.^2 * p2 + u.^3 * p3]; %#ok<AGROW>
                        cur = p3;
                    otherwise
                        i = i + 1;
                end
            end
        end

        function d = pathD(pts, closed)
            % PATHD  A polyline as the path tools/corrections.py writes: cubics with
            % collinear control points, which is what the pipeline's reader accepts.
            if nargin < 2, closed = false; end
            f = @(v) regexprep(regexprep(sprintf('%.2f', v), '0+$', ''), '\.$', '');
            parts = {sprintf('M %s %s', f(pts(1, 1)), f(pts(1, 2)))};
            for k = 1:size(pts, 1) - 1
                a = pts(k, :);
                b = pts(k+1, :);
                c1 = a + (b - a) / 3;
                c2 = a + 2 * (b - a) / 3;
                parts{end+1} = sprintf('C %s %s %s %s %s %s', f(c1(1)), f(c1(2)), f(c2(1)), f(c2(2)), f(b(1)), f(b(2))); %#ok<AGROW>
            end
            if closed, parts{end+1} = 'Z'; end
            d = strjoin(parts, ' ');
        end

        function out = ringsOf(c)
            % RINGSOF  Whatever jsondecode made of GeoJSON coordinates -> a cell of N x 2 rings.
            out = {};
            if iscell(c)
                for k = 1:numel(c), out = [out, AtlasRegionFix.ringsOf(c{k})]; end %#ok<AGROW>
            elseif isnumeric(c) && ~isempty(c)
                sz = size(c);
                if numel(sz) == 2
                    if sz(2) == 2
                        out = {double(c)};
                    elseif sz(1) == 2
                        out = {double(c')};
                    end                     % anything else is not a ring
                else
                    for k = 1:sz(1)         % the leading dimensions index rings, or polygons of rings
                        sub = reshape(c(k, :), [sz(2:end) 1]);
                        out = [out, AtlasRegionFix.ringsOf(sub)]; %#ok<AGROW>
                    end
                end
            end
        end
    end

    % ================================================================ transport
    methods (Access = private)
        function validateDraft(A)
            if isempty(A.Abbr), error('AtlasRegionFix:draft', 'name the region first: A.select(''S1DZ'')'); end
            if isempty(strtrim(A.Draft.problem))
                error('AtlasRegionFix:draft', 'say what is wrong first: A.problem(''...'')');
            end
            if isempty(A.Draft.seeds) && isempty(A.Draft.boundaries) && isempty(A.Draft.extents)
                error('AtlasRegionFix:draft', 'mark something first: addSeed, addBoundary or addExtent');
            end
        end

        function id = makeId(A)
            stamp = char(datetime('now', 'TimeZone', 'UTC', 'Format', 'yyyyMMdd''T''HHmmss''Z'''));
            id = sprintf('%s-p%02d-%s', stamp, A.Plate, regexprep(A.Abbr, '[^A-Za-z0-9_-]', '_'));
        end

        function a = authorName(A)
            a = A.Author;
            if isempty(a), a = getenv('USER'); end
            if isempty(a), a = getenv('USERNAME'); end
        end

        function h = hemisphereOf(A)
            h = A.Draft.hemisphere;
            if ~isempty(h), return; end
            ml = [];
            for k = 1:numel(A.Draft.seeds), ml(end+1) = A.Draft.seeds{k}.mm(1); end %#ok<AGROW>
            for k = 1:numel(A.Draft.boundaries), ml(end+1) = mean(A.Draft.boundaries{k}.mm(:, 1)); end %#ok<AGROW>
            for k = 1:numel(A.Draft.extents), ml(end+1) = mean(A.Draft.extents{k}.mm(:, 1)); end %#ok<AGROW>
            if isempty(ml), h = ''; elseif all(ml < 0), h = 'left'; elseif all(ml > 0), h = 'right'; else, h = 'both'; end
        end

        function commitWithGit(A, id, branch, json, png, title_, body)
            root = A.Repo;
            A.git(root, 'fetch origin main');
            wt = fullfile(tempdir, ['atlasfix-' id]);
            A.git(root, sprintf('worktree add -b "%s" "%s" origin/main', branch, wt));
            cleanup = onCleanup(@() A.dropWorktree(root, wt, branch)); %#ok<NASGU>
            if ~isfolder(fullfile(wt, 'corrections')), mkdir(fullfile(wt, 'corrections')); end
            AtlasRegionFix.writeText(fullfile(wt, 'corrections', [id '.json']), json);
            files = sprintf('corrections/%s.json', id);
            if ~isempty(png)
                AtlasRegionFix.writeBytes(fullfile(wt, 'corrections', [id '.png']), png);
                files = sprintf('%s corrections/%s.png', files, id);
            end
            A.git(wt, ['add ' files]);
            msg = fullfile(wt, '.correction-message');
            AtlasRegionFix.writeText(msg, sprintf('%s\n\n%s\n', title_, body));
            A.git(wt, sprintf('commit -q -F "%s"', msg));
            delete(msg);
            A.git(wt, sprintf('push -u origin "%s"', branch));
        end

        function dropWorktree(~, root, wt, branch)
            % the worktree was only ever a place to commit from; the branch lives on origin
            [~, ~] = system(sprintf('git -C "%s" worktree remove --force "%s"', root, wt));
            [~, ~] = system(sprintf('git -C "%s" worktree prune', root));
            [~, ~] = system(sprintf('git -C "%s" branch -D "%s"', root, branch));
        end

        function out = git(~, dir, args)
            cmd = sprintf('git -C "%s" %s', dir, args);
            [st, out] = system(cmd);
            if st ~= 0
                error('AtlasRegionFix:git', 'failed: %s\n%s', cmd, out);
            end
        end

        function commitWithApi(A, id, branch, json, png, title_, body)
            tok = A.Token;
            if isempty(tok), tok = getenv('GITHUB_TOKEN'); end
            if isempty(tok)
                error('AtlasRegionFix:token', ['no clone and no token: give ''Repo'' a local clone, or set GITHUB_TOKEN ' ...
                    '(a fine-grained token for %s/%s with contents: read and write) or A.Token'], A.Owner, A.RepoName);
            end
            api = sprintf('https://api.github.com/repos/%s/%s/', A.Owner, A.RepoName);
            hdr = {'Authorization', ['Bearer ' tok]; 'Accept', 'application/vnd.github+json'; ...
                'X-GitHub-Api-Version', '2022-11-28'};
            get = weboptions('HeaderFields', hdr, 'Timeout', 60);
            post = weboptions('HeaderFields', hdr, 'Timeout', 60, 'MediaType', 'application/json', 'RequestMethod', 'post');
            try
                ref = webread([api 'git/ref/heads/main'], get);
                parent = ref.object.sha;
                base = webread([api 'git/commits/' parent], get);
                tree = {};
                b = webwrite([api 'git/blobs'], struct('content', json, 'encoding', 'utf-8'), post);
                tree{end+1} = struct('path', sprintf('corrections/%s.json', id), 'mode', '100644', 'type', 'blob', 'sha', b.sha);
                if ~isempty(png)
                    b = webwrite([api 'git/blobs'], struct('content', matlab.net.base64encode(png), 'encoding', 'base64'), post);
                    tree{end+1} = struct('path', sprintf('corrections/%s.png', id), 'mode', '100644', 'type', 'blob', 'sha', b.sha);
                end
                t = webwrite([api 'git/trees'], struct('base_tree', base.tree.sha, 'tree', {tree}), post);
                cm = webwrite([api 'git/commits'], struct('message', sprintf('%s\n\n%s\n', title_, body), ...
                    'tree', t.sha, 'parents', {{parent}}), post);
                webwrite([api 'git/refs'], struct('ref', ['refs/heads/' branch], 'sha', cm.sha), post);
            catch err
                error('AtlasRegionFix:api', 'GitHub refused: %s\n(the token needs contents: read and write on %s/%s)', ...
                    err.message, A.Owner, A.RepoName);
            end
        end
    end

    methods (Static, Access = private)
        function e = pointsAsCells(e)
            % N x 2 -> a cell of 1 x 2 rows, so jsonencode writes [[x,y],...] whatever N is
            e.page_px = num2cell(e.page_px, 2)';
            e.mm = num2cell(e.mm, 2)';
        end

        function out = asCells(c, field, fn)
            out = {};
            if ~isfield(c, field) || isempty(c.(field)), return; end
            v = c.(field);
            if ~iscell(v), v = num2cell(v); end
            for k = 1:numel(v), out{end+1} = fn(v{k}); end %#ok<AGROW>
        end

        function s = seedIn(A, s0)
            s = struct('abbr', char(s0.abbr), 'kind', 'positive', 'page_px', [], 'mm', [], 'note', '');
            if isfield(s0, 'kind') && ~isempty(s0.kind), s.kind = char(s0.kind); end
            if isfield(s0, 'note') && ~isempty(s0.note), s.note = char(s0.note); end
            if isfield(s0, 'page_px') && ~isempty(s0.page_px)
                s.page_px = reshape(s0.page_px, 1, 2);
                s.mm = round(A.pageToMm(s.page_px), 3);
            else
                s.mm = reshape(s0.mm, 1, 2);
                s.page_px = round(A.mmToPage(s.mm), 2);
            end
            if isfield(s0, 'label_index') && ~isempty(s0.label_index), s.label_index = s0.label_index; end
        end

        function p = polyIn(A, p0, what)
            if isfield(p0, 'page_px') && ~isempty(p0.page_px)
                xy = AtlasRegionFix.ringsOf(p0.page_px);
                if isempty(xy), xy = {reshape(p0.page_px, [], 2)}; end
                xy = xy{1};
            else
                mm = AtlasRegionFix.ringsOf(p0.mm);
                if isempty(mm), mm = {reshape(p0.mm, [], 2)}; end
                xy = A.mmToPage(mm{1});
            end
            p = struct('page_px', round(xy, 2), 'mm', round(A.pageToMm(xy), 3), 'note', '');
            if isfield(p0, 'note') && ~isempty(p0.note), p.note = char(p0.note); end
            if strcmp(what, 'boundary')
                p.style = 'solid';
                p.closed = false;
                if isfield(p0, 'style') && ~isempty(p0.style), p.style = char(p0.style); end
                if isfield(p0, 'closed') && ~isempty(p0.closed), p.closed = logical(p0.closed); end
                p = orderfields(p, {'style', 'closed', 'page_px', 'mm', 'note'});
            else
                p.abbr = char(p0.abbr);
                p = orderfields(p, {'abbr', 'page_px', 'mm', 'note'});
            end
        end

        function writeText(file, txt)
            fid = fopen(file, 'w');           % binary: LF line endings on every platform
            if fid < 0, error('AtlasRegionFix:write', 'cannot write %s', file); end
            fwrite(fid, unicode2native(txt, 'UTF-8'), 'uint8');
            fclose(fid);
        end

        function writeBytes(file, bytes)
            fid = fopen(file, 'w');
            fwrite(fid, bytes, 'uint8');
            fclose(fid);
        end

        function bytes = readBytes(file)
            fid = fopen(file, 'r');
            bytes = fread(fid, '*uint8');
            fclose(fid);
        end

        function v = iif(cond, a, b)
            if cond, v = a; else, v = b; end
        end
    end
end
