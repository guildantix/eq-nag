import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, HostListener, Inject, Input, OnDestroy, OnInit, Renderer2 } from '@angular/core';

/**
 * Adds a drag handle on one edge of the host element so the user can resize it.
 */
@Directive( {
    selector: '[nagResizeable]',
} )
export class ResizeableDirective implements OnInit, OnDestroy {

    private _dragElement: HTMLDivElement;

    /** Keeps the handle on the host's edge when the host resizes without a window resize. */
    private _hostResizeObserver: ResizeObserver | undefined = undefined;
    private _userSelectValue: string | undefined = undefined;

    private _heightMax: number | undefined = undefined;
    private _widthMax: number | undefined = undefined;

    @Input('resizeMax') set max( value: number | string ) {

        if ( typeof value === 'string' ) {
            if ( value.indexOf( '%' ) > -1 ) {
                value = parseInt( value.replace( '%', '' ), 10 );
                value = value / 100;

                this._heightMax = this.document.defaultView.innerHeight * value;
                this._widthMax = this.document.defaultView.innerWidth * value;

            } else if ( value.indexOf( 'px' ) > -1 ) {
                value = parseInt( value.replace( 'px', '' ), 10 );
                
                this._heightMax = value;
                this._widthMax = value;

            } else {
                value = parseInt( value, 10 );

                this._heightMax = value;
                this._widthMax = value;

            }
        }

    }

    private _location: 'top' | 'bottom' | 'left' | 'right' = 'top';
    @Input( 'resizeLocation' ) set location( value: 'top' | 'bottom' | 'left' | 'right' ) {
        this._location = value;

        this.createDragElement();
    }
    get location(): 'top' | 'bottom' | 'left' | 'right' {
        return this._location;
    }
    private _visibility: 'hidden' | 'visible' = 'hidden';
    @Input( 'resizeVisibility' ) set visibility( value: 'hidden' | 'visible' ) {
        
        if ( !this._dragElement ) {
            return;
        }

        this.renderer.setStyle( this._dragElement, 'opacity', value === 'hidden' ? 0 : 1 );

        this._visibility = value;
    }
    public get visibility(): 'hidden' | 'visible' {
        return this._visibility;
    }

    private _dragging: boolean = false;
    @HostListener( 'document:mousedown', [ '$event' ] ) onMousedownHandler( event: MouseEvent ) {
        if ( this._dragging ) {
            return;
        }
        
        if ( event.target === this._dragElement ) {
            this._userSelectValue = this.elementRef.nativeElement.style.userSelect;
            this.elementRef.nativeElement.style.userSelect = 'none';
            this._dragging = true;
        }
    }










    /**
     * Ends a drag when the window loses focus mid-drag (alt-tab), which sends no mouseup, so the
     * panel doesn't stay unselectable and keep following the mouse.
     *
     * @param event The blur event.
     */
    @HostListener( 'window:blur', [ '$event' ] ) onWindowBlurHandler( event: FocusEvent ) {
        this.onMouseupHandler( null );
    }










    /**
     * Ends a drag: restores text selection on the panel and moves the handle to its new edge.
     *
     * @param event The mouseup event, or null when the drag ends because the window lost focus.
     */
    @HostListener( 'document:mouseup', [ '$event' ] ) onMouseupHandler( event: MouseEvent | null ) {
        // Every click in the app ends here; only a drag has anything to undo.
        if ( !this._dragging ) {
            return;
        }
        this.elementRef.nativeElement.style.userSelect = this._userSelectValue;
        this._dragging = false;
        this.setPosition();
    }










    /**
     * The handle is placed in viewport pixels, so it must follow the host when the window resizes.
     *
     * @param event The window resize event, unused.
     */
    @HostListener( 'window:resize', [ '$event' ] ) onWindowResizeHandler( event: Event ) {
        this.setPosition();
    }

    @HostListener( 'document:mousemove', [ '$event' ] ) onMousemoveHandler( event: MouseEvent ) {
        if ( !this._dragging ) {
            return;
        }
        
        if ( this._location === 'top' ) {
            this.renderer.setStyle( this.elementRef.nativeElement, 'height', `${this.elementRef.nativeElement.offsetHeight - event.movementY}px` );

            if ( this.elementRef.nativeElement.offsetHeight < 0 ) {
                this.renderer.setStyle( this.elementRef.nativeElement, 'height', `50px` );
            } else if ( this._heightMax > 0 && this.elementRef.nativeElement.offsetHeight > this._heightMax ) {
                this.renderer.setStyle( this.elementRef.nativeElement, 'height', `${this._heightMax}px` );
            }

        } else if ( this._location === 'bottom' ) {
            this.renderer.setStyle( this.elementRef.nativeElement, 'height', `${this.elementRef.nativeElement.offsetHeight + event.movementY}px` );
        } else if ( this._location === 'left' ) {
            this.renderer.setStyle( this.elementRef.nativeElement, 'width', `${this.elementRef.nativeElement.offsetWidth - event.movementX}px` );

            if ( +this.elementRef.nativeElement.offsetWidth > this._widthMax ) {
                this.renderer.setStyle( this.elementRef.nativeElement, 'width', `${this._widthMax}px` );
            }

        } else if ( this._location === 'right' ) {
            this.renderer.setStyle( this.elementRef.nativeElement, 'width', `${this.elementRef.nativeElement.offsetWidth + event.movementX}px` );
        }

    }
    
    constructor(
        private elementRef: ElementRef<HTMLElement>,
        private renderer: Renderer2,
        @Inject( DOCUMENT ) private document: Document
    ) { }

    ngOnInit() {
        let computedStyle = this.document.defaultView.getComputedStyle( this.elementRef.nativeElement );

        if ( !computedStyle.position || computedStyle.position === 'static' ) {
            this.renderer.setStyle( this.elementRef.nativeElement, 'position', 'relative' );
        }

        this.createDragElement();

        if ( typeof ResizeObserver !== 'undefined' ) {
            this._hostResizeObserver = new ResizeObserver( () => this.setPosition() );
            this._hostResizeObserver.observe( this.elementRef.nativeElement );
        }
    }










    /**
     * The handle lives on document.body, outside the host, so remove it here or it leaks.
     */
    ngOnDestroy() {
        if ( this._hostResizeObserver ) {
            this._hostResizeObserver.disconnect();
            this._hostResizeObserver = undefined;
        }

        this.removeDragElement();
    }










    /**
     * Removes the handle from document.body if it is there.
     */
    private removeDragElement() {
        if ( this._dragElement ) {
            this._dragElement.remove();
            this._dragElement = undefined;
        }
    }










    /**
     * Creates the handle on document.body, replacing any earlier one so none is orphaned.
     */
    private createDragElement() {
        this.removeDragElement();

        // Create the drag element
        this._dragElement = this.renderer.createElement( 'div' );
        this._dragElement.style.userSelect = 'none';

        // Add the classes
        this.renderer.addClass( this._dragElement, 'resize-handle' );
        this.renderer.addClass( this._dragElement, `resize-${this._location}` );
        
        // Add the element to the parent
        this.renderer.appendChild( document.body, this._dragElement );

        this.setPosition();

        // Set the visibility
        this.renderer.setStyle( this._dragElement, 'opacity', this.visibility === 'hidden' ? 0 : 1 );

    }










    /**
     * Places the handle on the host's edge using the host's current viewport rectangle.
     */
    private setPosition() {
        if ( !this._dragElement ) {
            return;
        }

        let ownerRect = this.elementRef.nativeElement.getBoundingClientRect();

        if ( ownerRect ) {
            if ( this._location === 'top' ) {
                this.renderer.setStyle( this._dragElement, 'top', `${ownerRect.top}px` );
                this.renderer.setStyle( this._dragElement, 'left', `${ownerRect.left}px` );
                this.renderer.setStyle( this._dragElement, 'width', `${ownerRect.width}px` );
                this.renderer.setStyle( this._dragElement, 'height', `5px` );
            } else if ( this._location === 'bottom' ) {
                this.renderer.setStyle( this._dragElement, 'top', `${ownerRect.bottom - 5}px` );
                this.renderer.setStyle( this._dragElement, 'left', `${ownerRect.left}px` );
                this.renderer.setStyle( this._dragElement, 'width', `${ownerRect.width}px` );
                this.renderer.setStyle( this._dragElement, 'height', `5px` );
            } else if ( this._location === 'left' ) {
                this.renderer.setStyle( this._dragElement, 'top', `${ownerRect.top}px` );
                this.renderer.setStyle( this._dragElement, 'left', `${ownerRect.left}px` );
                this.renderer.setStyle( this._dragElement, 'width', `5px` );
                this.renderer.setStyle( this._dragElement, 'height', `${ownerRect.height}px` );
            } else if ( this._location === 'right' ) {
                this.renderer.setStyle( this._dragElement, 'top', `${ownerRect.top}px` );
                this.renderer.setStyle( this._dragElement, 'left', `${ownerRect.right - 5}px` );
                this.renderer.setStyle( this._dragElement, 'width', `5px` );
                this.renderer.setStyle( this._dragElement, 'height', `${ownerRect.height}px` );
            }
        
        }
    }


}
