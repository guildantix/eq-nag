import { Component, OnInit, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component( {
    selector: 'app-duration',
    templateUrl: 'duration.component.html',
    styleUrls: [ 'duration.component.scss' ],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef( () => DurationComponent ),
            multi: true
        }
    ],
} )
export class DurationComponent implements OnInit, ControlValueAccessor {

    onChange: any = () => { }
    onTouch: any = () => { }

    public hours: number;
    public minutes: number;
    public seconds: number;
    public duration: number;
    public disabled: boolean = false;

    @Input() inline: boolean = false;

    constructor() { }

    public valueChanged( e: any ): void {
        this.duration = 0;
        this.duration += ( this.hours > 0 ? this.hours : 0 ) * 60 * 60;
        this.duration += ( this.minutes > 0 ? this.minutes : 0 ) * 60;
        this.duration += ( this.seconds > 0 ? this.seconds : 0 );
        this.hours = this.hours > 0 ? this.hours : null;
        this.minutes = this.minutes > 0 ? this.minutes : null;
        this.seconds = this.seconds > 0 ? this.seconds : null;
        this.onChange( this.duration );
        this.onTouch( this.duration );
    }

    writeValue( duration: number ): void {
        this.duration = duration;
        let hours = Math.floor( duration / 60 / 60 );
        let minutes = Math.floor( ( duration - hours * 60 * 60 ) / 60 );
        let seconds = duration - hours * 60 * 60 - minutes * 60;
        this.hours = hours > 0 ? hours : null;
        this.minutes = minutes > 0 ? minutes : null;
        this.seconds = seconds > 0 ? seconds : null;
    }
  
    registerOnChange( fn: any ) {
        this.onChange = fn
    }
  
    registerOnTouched( fn: any ) {
        this.onTouch = fn
    }
    setDisabledState?( isDisabled: boolean ): void {
        this.disabled = isDisabled;
    }

    public add( value: number ): number {
        value += 1;
        window.setTimeout( () => this.valueChanged( {} ) );
        return value > 0 ? value : null;
    }

    public subtract( value: number ): number {
        value -= 1;
        window.setTimeout( () => this.valueChanged( {} ) );
        return value > 0 ? value : null;
    }

    ngOnInit() { }

}