import { Directive, ElementRef, HostListener, Input } from '@angular/core';
import { EasingUtilities, MathUtilities } from '../utilities/math.utilities';

@Directive( { selector: '[horizontalScroll]' } )
export class HorizontalScrollDirective {

    private destinationScroll: number = null;
    private animationId: number = null;
    private animationStart: number = null;
    private animationEnd: number = null;
    private wheelTickDuration: number = 200;
    private startScroll: number = null;

    @HostListener( 'mousewheel', [ '$event' ] ) onMouseWheel( e: WheelEvent ) {
        
        if ( Math.abs( e.deltaY ) > 0 ) {
            
            let min = 0;
            let max = this.el.nativeElement.scrollWidth - this.el.nativeElement.clientWidth;
            this.destinationScroll = MathUtilities.clamp( this.destinationScroll + e.deltaY, min, max );
            if ( this.destinationScroll !== min && this.destinationScroll !== max ) {
                this.animationEnd = Date.now() + this.wheelTickDuration;
            }

            if ( this.animationId == null ) {
                this.animationStart = Date.now();
                this.startScroll = this.el.nativeElement.scrollLeft;
                this.animationId = window.setInterval( () => {
                    let now = Date.now();
                    let tPos = now - this.animationStart;
                    let lPos = this.animationEnd - this.animationStart;

                    let x = this.destinationScroll - this.startScroll;
                    this.el.nativeElement.scrollLeft = this.startScroll + EasingUtilities.easeOutSine( tPos / lPos ) * x;
                    
                    if ( now >= this.animationEnd ) {
                        this.el.nativeElement.scrollLeft = this.destinationScroll;
                        window.clearInterval( this.animationId );
                        this.animationId = null;
                    }

                } );
            }

        }
        
        e.preventDefault();
    }

    constructor( private el: ElementRef ) {
        console.log( 'init', el );
    }

}
