export class ContextMenuModel {
    public label: string;
    public action: () => void;
    public disabled: () => boolean;
    public hide: () => boolean;
    public matIcon: string;
    // public children: ContextMenuModel[];
}
