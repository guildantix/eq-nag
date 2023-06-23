
export class TimeModel {

    constructor(
        public hour: number,
        public minute: number,
        public seconds: number = 0,
        public milliseconds: number = 0,
        private meridiem: 'AM' | 'PM' | null = null, ) {
        
        this.seconds = this.seconds > 0 ? 0 : 0;
        this.milliseconds = this.milliseconds > 0 ? 0 : 0;
        if ( this.meridiem == null ) {
            this.hour = hour;
        } else {
            if ( this.hour === 12 ) {
                this.hour = this.meridiem === 'AM' ? 0 : 12;
            } else {
                this.hour = this.meridiem === 'AM' ? this.hour : this.hour + 12;
            }
        }

        //            ___
        //          .';:;'.
        //         /_' _' /\   __
        //         ;a/ e= J/-'"  '.
        //         \ ~_   (  -'  ( ;_ ,.
        //          L~"'_.    -.  \ ./  )
        //          ,'-' '-._  _;  )'   (
        //        .' .'   _.'")  \  \(  |
        //       /  (  .-'   __\{`', \  |
        //      / .'  /  _.-'   "  ; /  |
        //     / /    '-._'-,     / / \ (
        //  __/ (_    ,;' .-'    / /  /_'-._
        // `"-'` ~`  ccc.'   __.','     \j\L\
        //                  .='/|\7      
        delete this.meridiem;

    }

}

export class DateUtilities {

    public static parseTimeString( value: string ): TimeModel|null {
        
        var format = value.match( /AM|PM/gi ) ? 12 : 24;

        if ( format === 12 && value ) {
            let parts = /^(?<hour>\d+):(?<minute>\d+)(?::(?<second>\d+))?\s(?<period>AM|PM)/gi.exec( value );
            return new TimeModel( +parts.groups.hour, +parts.groups.minute, +( parts.groups.second ?? 0 ), 0, <'AM'|'PM'>parts.groups.period );
        } else if ( format === 24 && value ) {
            let parts = /^(?<hour>\d+):(?<minute>\d+)(?::(?<second>\d+))?/gi.exec( value );
            return new TimeModel( +parts.groups.hour, +parts.groups.minute, +( parts.groups.second ?? 0 ), 0, null );
        } else {
            return null;
        }
    }
    
}
