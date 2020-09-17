var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var SettingsManager;
(function (SettingsManager) {
    const DEFAULT = {
        frameNamePattern: '^.*$',
        outputPathPattern: '$0',
        png: true,
        jpg: false,
    };
    const FIELDS = Object.keys(DEFAULT);
    const CLIENT_STORAGE_PREFIX = 'HarryExporter.';
    function load() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = {};
            const promises = FIELDS.map(field => figma.clientStorage.getAsync(CLIENT_STORAGE_PREFIX + field).then(value => ({ field, value: value === undefined ? DEFAULT[field] : value })));
            (yield Promise.all(promises)).forEach(({ field, value }) => {
                result[field] = value;
            });
            return result;
        });
    }
    SettingsManager.load = load;
    function save(settings) {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.all(FIELDS.map(field => figma.clientStorage.setAsync(CLIENT_STORAGE_PREFIX + field, settings[field])));
        });
    }
    SettingsManager.save = save;
})(SettingsManager || (SettingsManager = {}));
;
function prepareTasks(frameNamePattern, outputPathPattern, formats) {
    return __awaiter(this, void 0, void 0, function* () {
        let frameNameRegExp = null;
        try {
            frameNameRegExp = new RegExp(frameNamePattern);
        }
        catch (_) {
            throw { error: 'invalid regular expression `' + frameNamePattern + '`' };
        }
        const frameNodes = selectFrameNodes(frameNameRegExp);
        const result = frameNodes.flatMap(node => prepareNodeTasks(node, frameNameRegExp, outputPathPattern, formats));
        const paths = new Set();
        result.forEach(({ path }) => {
            if (paths.has(path)) {
                throw { error: 'multiple frames share the same path: ' + path };
            }
            paths.add(path);
        });
        result.sort((a, b) => a.path < b.path ? -1 : (a.path > b.path ? 1 : 0));
        return result;
    });
}
function selectFrameNodes(frameNameRegExp) {
    return figma.root.findAll(node => (node.type === 'COMPONENT' || node.type === 'FRAME' || node.type === 'INSTANCE') && frameNameRegExp.test(node.name)).map(node => node);
}
function prepareNodeTasks(node, frameNameRegExp, outputPathPattern, formats) {
    const matchArray = node.name.match(frameNameRegExp);
    let pathPrefix = outputPathPattern;
    for (let i = matchArray.length - 1; i >= 0; --i) {
        pathPrefix = pathPrefix.replace('$' + i, matchArray[i] || '');
    }
    return formats.map(format => ({ nodeId: node.id, format, path: pathPrefix + '.' + format }));
}
function exportAndSendBlob(task) {
    return __awaiter(this, void 0, void 0, function* () {
        const blob = yield figma.getNodeById(task.nodeId).exportAsync({ format: task.format.toUpperCase() });
        figma.ui.postMessage({ type: 'blob', path: task.path, blob });
    });
}
figma.showUI(__html__, { width: 320, height: 480 });
figma.ui.onmessage = (message) => __awaiter(this, void 0, void 0, function* () {
    if (message.type === 'load-settings') {
        const settings = yield SettingsManager.load();
        console.log('Loaded settings:', settings);
        figma.ui.postMessage({ type: 'settings', settings });
    }
    else if (message.type === 'select') {
        yield SettingsManager.save(message.settings);
        const { frameNamePattern, outputPathPattern, png, jpg } = message.settings;
        const formats = (png ? ['png'] : []).concat(jpg ? ['jpg'] : []);
        yield prepareTasks(frameNamePattern, outputPathPattern, formats)
            .then(tasks => {
            figma.ui.postMessage({ type: 'tasks', tasks });
        })
            .catch(reason => {
            if ('error' in reason) {
                figma.notify('Selection failed: ' + reason.error);
            }
            else {
                figma.notify(reason.toString());
            }
            figma.ui.postMessage({ type: 'tasks', tasks: [] });
        });
    }
    else if (message.type === 'export') {
        yield exportAndSendBlob(message.task);
    }
    else if (message.type === 'focus-node') {
        const node = figma.getNodeById(message.id);
        let ancestor = node.parent;
        while (ancestor.type !== 'PAGE') {
            ancestor = ancestor.parent;
        }
        figma.currentPage = ancestor;
        figma.viewport.zoom = 1000.0;
        figma.viewport.scrollAndZoomIntoView([node]);
        figma.viewport.zoom = 0.75 * figma.viewport.zoom;
    }
});
