export function createPluginApi(manifest: any, host: any): Readonly<{
    manifest: any;
    log: (...args: any[]) => any;
    Activity: typeof Activity;
    View: typeof View;
    EditorView: typeof EditorView;
    ModalView: typeof ModalView;
    PanelView: typeof PanelView;
    ViewSection: typeof ViewSection;
    StatusView: typeof StatusView;
}>;
import { Activity } from '../models/ui/index.js';
import { View } from '../models/ui/index.js';
import { EditorView } from '../models/ui/index.js';
import { ModalView } from '../models/ui/index.js';
import { PanelView } from '../models/ui/index.js';
import { ViewSection } from '../models/ui/index.js';
import { StatusView } from '../models/ui/index.js';
