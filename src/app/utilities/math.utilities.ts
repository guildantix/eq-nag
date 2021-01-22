// Much help from https://easings.net
export class EasingUtilities {

    /**
     * Returns the eased position from 0 to 1.
     * 
     * @param x The current progress of the animation, from 0 to 1.
     */
    public static easeOutQuart( x: number ): number {
        return 1 - Math.pow( 1 - x, 4 );
    }

    /**
     * Returns the eased position from 0 to 1.
     * 
     * @param x The current progress of the animation, from 0 to 1.
     */
    public static easeOutQuad( x: number ): number {
        return 1 - ( 1 - x ) * ( 1 - x );
    }

    /**
     * Returns the eased position from 0 to 1.
     * 
     * @param x The current progress of the animation, from 0 to 1.
     */
    public static easeOutExpo( x: number ): number {
        return x === 1 ? 1 : 1 - Math.pow( 2, -10 * x );
    }

    /**
     * Returns the eased position from 0 to 1.
     * 
     * @param x The current progress of the animation, from 0 to 1.
     */
    public static easeOutSine( x: number ): number {
        return Math.sin( ( x * Math.PI ) / 2 );
    }

}

export class MathUtilities {
    /**
     * Returns value clamped between the inclusive barriers min and max.
     * 
     * @param value The value to evaluate.
     * @param min The minimum value.
     * @param max The maximum value.
     */
    public static clamp( value: number, min: number, max: number ): number {

        if ( value < min ) {
            return min;
        } else if ( value > max ) {
            return max;
        }
        
        return value;
    }
}
