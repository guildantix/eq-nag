import { AfterViewInit, ComponentRef, Directive, ElementRef, HostListener, Input, Renderer2, ViewContainerRef } from '@angular/core';
import { ContextMenuComponent } from './context-menu.component';
import { ContextMenuModel } from './context-menu.model';

@Directive( { selector: '[appContextMenu]' } )
export class ContextMenuDirective implements AfterViewInit {

    private _menu: ContextMenuModel[];
    public get menu(): ContextMenuModel[] {
        return this._menu;
    }
    @Input( 'appContextMenu' ) public set menu( value: ContextMenuModel[] ) {
        this._menu = value;
    }

    @HostListener( 'contextmenu', [ '$event' ] ) public onContextMenu( { x, y }: MouseEvent ): void {
        this.contextMenu.instance.open( x, y );
    }

    private contextMenu: ComponentRef<ContextMenuComponent>;
  
    constructor(
        private viewContainerRef: ViewContainerRef,
    ) { }
  
    ngAfterViewInit() {
        // create component
        this.contextMenu = this.viewContainerRef.createComponent( ContextMenuComponent );
        this.contextMenu.instance.menu = this.menu;
        this.contextMenu.changeDetectorRef.detectChanges();
    }
}
