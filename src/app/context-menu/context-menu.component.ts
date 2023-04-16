import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { Component, ElementRef, Input, OnInit, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { fromEvent, Subscription } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { ContextMenuModel } from './context-menu.model';
import { ContextService } from './context.service';

@Component( {
    selector: 'app-context-menu',
    templateUrl: 'context-menu.component.html',
    styleUrls: [ 'context-menu.component.scss' ]
} )
export class ContextMenuComponent implements OnInit {

    // public keys: string[] = [];
    public overlayRef: OverlayRef | null;
    public clickSub: Subscription;
    public scrollSub: Subscription;
    public isOpen: boolean = false;
    @ViewChild( 'contextMenuTemplate' ) menuTemplate: TemplateRef<any>;
    @ViewChild( 'mainBackground' ) mainBackground: ElementRef<HTMLElement>;
    
    public keepOpen: boolean = false;
    
    private _menu: ContextMenuModel[];
    public get menu(): ContextMenuModel[] {
        return this._menu;
    }
    @Input( 'menu' ) public set menu( value: ContextMenuModel[] ) {
        // this.keys = Object.keys( value );
        this._menu = value;
    }

    constructor(public overlay: Overlay, public viewContainerRef: ViewContainerRef, private contextService: ContextService) { }

    ngOnInit() {
        
    }

    public open( x: number, y: number ): void {

        if ( this.isOpen ) {
            this.close();
        }

        const positionStrategy = this.overlay.position()
            .flexibleConnectedTo( { x, y } )
            .withPositions( [
                {
                    originX: 'end',
                    originY: 'bottom',
                    overlayX: 'end',
                    overlayY: 'top',
                }
            ] );
        
        this.overlayRef = this.overlay.create( {
            positionStrategy,
            /* This scroll strategy only works when the main body is scrolled.
               You can add 'cdk-scrollable' to all scrollable elements, but 
               that leaves context-menu not self-contained because you would 
               need to make sure that any scrollable parent of an item with a 
               context menu has cdk-scrollable directive applied.  And as the 
               angular team correctly states, there's no performant way to do 
               that.  What we're doing with the context menu is just attaching 
               a handler to all mouse wheel events and closing the context 
               menu there. */
            scrollStrategy: this.overlay.scrollStrategies.close()
        } );

        this.overlayRef.attach( new TemplatePortal( this.menuTemplate, this.viewContainerRef, {
            // $implicit: user
        } ) );

        this.clickSub = fromEvent<MouseEvent>( document, 'click' )
            .subscribe( () => {
                if ( !this.keepOpen ) {
                    this.close();
                } else {
                    this.keepOpen = false;
                }
            } );

        this.scrollSub = fromEvent<MouseEvent>( document, 'mousewheel' )
            .subscribe( () => this.close() );
        
        this.isOpen = true;
        this.contextService.closeAllButThis( this );
    }

    public close(): void {
        this.clickSub && this.clickSub.unsubscribe();
        this.scrollSub && this.scrollSub.unsubscribe();
        this.isOpen = false;
        if ( this.overlayRef ) {
            this.overlayRef.dispose();
            this.overlayRef = null;
        }
    }

    public executeAction( menuItem: ContextMenuModel, subMenu?: HTMLElement ): void {
        if ( menuItem.children?.length > 0 ) {
            this.keepOpen = true;
            let padding = 5;
            let left = this.mainBackground.nativeElement.offsetLeft + this.mainBackground.nativeElement.offsetWidth;
            if ( left + subMenu.offsetWidth > window.innerWidth - padding ) {
                left = left - ( left + subMenu.offsetWidth - window.innerWidth ) - padding;
            }
            subMenu.style.left = `${left}px`;
            
            let topMargin = -41;
            let bottom = subMenu.offsetTop + subMenu.offsetHeight + this.mainBackground.nativeElement.offsetTop + this.overlayRef.overlayElement.offsetTop;
            if ( bottom > window.innerHeight - padding ) {
                topMargin = topMargin - ( bottom - window.innerHeight ) - padding;
            }
            subMenu.style.marginTop = `${topMargin}px`;
            
        } else {
            this.keepOpen = menuItem.keepOpen === true;
            menuItem.action();
        }
    }

    public getKeyLabel( key: string ): string {
        let label: string = key;

        let result = label.replace( /([A-Z])/g, " $1" );
        label = result.charAt( 0 ).toUpperCase() + result.slice( 1 );

        return label;
    }
}
