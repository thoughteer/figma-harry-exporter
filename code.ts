type Settings = {
    frameNamePattern: string;
    outputPathPattern: string;
    png: boolean;
    jpg: boolean;
};

namespace SettingsManager {
    const DEFAULT: Settings = {
        frameNamePattern: '^.*$',
        outputPathPattern: '$0',
        png: true,
        jpg: false,
    };
    const FIELDS = Object.keys(DEFAULT);
    const CLIENT_STORAGE_PREFIX = 'HarryExporter.';

    export async function load(): Promise<Settings> {
        const result = <Settings> {};
        const promises = FIELDS.map(field => figma.clientStorage.getAsync(CLIENT_STORAGE_PREFIX + field).then(value => ({field, value: value === undefined ? DEFAULT[field] : value})));
        (await Promise.all(promises)).forEach(({field, value}) => {
            result[field] = value;
        });
        return result;
    }

    export async function save(settings: Settings): Promise<void> {
        await Promise.all(FIELDS.map(field => figma.clientStorage.setAsync(CLIENT_STORAGE_PREFIX + field, settings[field])));
    }
};


type Task = {
    nodeId: string;
    path: string;
};


async function prepareTasks(frameNamePattern: string, outputPathPattern: string, formats: string[]): Promise<Task[]> {
    let frameNameRegExp: RegExp = null;
    try {
        frameNameRegExp = new RegExp(frameNamePattern);
    } catch (_) {
        throw {error: 'invalid regular expression `' + frameNamePattern + '`'};
    }
    const frameNodes = selectFrameNodes(frameNameRegExp);
    const result = frameNodes.flatMap(node => prepareNodeTasks(node, frameNameRegExp, outputPathPattern, formats));
    const paths = new Set<string>();
    result.forEach(({path}) => {
        if (paths.has(path)) {
            throw {error: 'multiple frames share the same path: ' + path};
        }
        paths.add(path);
    });
    result.sort((a, b) => a.path < b.path ? -1 : (a.path > b.path ? 1 : 0));
    return result;
}

function selectFrameNodes(frameNameRegExp: RegExp): DefaultFrameMixin[] {
    return figma.root.findAll(node => (node.type === 'COMPONENT' || node.type === 'FRAME' || node.type === 'INSTANCE') && frameNameRegExp.test(node.name)).map(node => node as DefaultFrameMixin);
}

function prepareNodeTasks(node: DefaultFrameMixin, frameNameRegExp: RegExp, outputPathPattern: string, formats: string[]): Task[] {
    const matchArray = node.name.match(frameNameRegExp);
    let pathPrefix = outputPathPattern;
    for (let i = matchArray.length - 1; i >= 0; --i) {
        pathPrefix = pathPrefix.replace('$' + i, matchArray[i] || '');
    }
    return formats.map(format => ({nodeId: node.id, format, path: pathPrefix + '.' + format}));
}

async function exportAndSendBlob(task: Task): Promise<void> {
    const blob = await (figma.getNodeById(task.nodeId) as DefaultFrameMixin).exportAsync({format: task.format.toUpperCase()});
    figma.ui.postMessage({type: 'blob', path: task.path, blob});
}


figma.showUI(__html__, {width: 320, height: 480});

figma.ui.onmessage = async message => {
    if (message.type === 'load-settings') {
        const settings = await SettingsManager.load();
        console.log('Loaded settings:', settings);
        figma.ui.postMessage({type: 'settings', settings});
    } else if (message.type === 'select') {
        await SettingsManager.save(message.settings);
        const {frameNamePattern, outputPathPattern, png, jpg} = message.settings;
        const formats = (png ? ['png'] : []).concat(jpg ? ['jpg'] : []);
        await prepareTasks(frameNamePattern, outputPathPattern, formats)
            .then(tasks => {
                figma.ui.postMessage({type: 'tasks', tasks});
            })
            .catch(reason => {
                if ('error' in reason) {
                    figma.notify('Selection failed: ' + reason.error);
                } else {
                    figma.notify(reason.toString());
                }
                figma.ui.postMessage({type: 'tasks', tasks: []});
            });
    } else if (message.type === 'export') {
        await exportAndSendBlob(message.task);
    } else if (message.type === 'focus-node') {
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
};
