import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, HostListener, Inject, Input, OnInit, Renderer2 } from '@angular/core';

@Directive( {
    selector: '[nagResizeable]',
} )
export class ResizeableDirective implements OnInit {

    private _dragElement: HTMLDivElement;
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
        if ( this._dragElement ) {
            this.renderer.removeChild( this.elementRef.nativeElement, this._dragElement );
        }
        
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

    @HostListener( 'document:mouseup', [ '$event' ] ) onMouseupHandler( event: MouseEvent ) {
        this.elementRef.nativeElement.style.userSelect = this._userSelectValue;
        this._dragging = false;
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
    }

    private createDragElement() {
        // Create the drag element
        this._dragElement = this.renderer.createElement( 'div' );

        // Add the classes
        this.renderer.addClass( this._dragElement, 'resize-handle' );
        this.renderer.addClass( this._dragElement, `resize-${this._location}` );5
        
        // Add the element to the parent
        this.renderer.appendChild( this.elementRef.nativeElement, this._dragElement );
        
        // Set the visibility
        this.renderer.setStyle( this._dragElement, 'opacity', this.visibility === 'hidden' ? 0 : 1 );

        console.log( this._dragElement );
    }


}
