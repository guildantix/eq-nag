import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { LogTypes, ProgressModel } from 'src/app/core.model';
import { replaceAt } from 'src/app/utilities/string.utilities';

@Component( {
    selector: 'console-progress',
    templateUrl: 'console-progress.component.html',
    styleUrls: [ 'console-progress.component.scss' ],
} )
export class ConsoleProgressComponent implements OnInit {

    @Input( 'item' ) public set setItem( value: any ) {
        this.item = value;
    }
    public item: ProgressModel = new ProgressModel();
    public logTypes: typeof LogTypes = LogTypes;
    public expanded: boolean = false;

    constructor(
        private readonly changeDetector: ChangeDetectorRef,
    ) { }

    ngOnInit() { }

    public progressBar(): string {
        // [=========%50==-------]
        //  ---------------------
        // let e = '---------50%---------';
        let base = '---------------------';
        let p = Math.round( this.item.progress * base.length );
        let progress = Math.round( this.item.progress * 100 );

        for ( let i = 0; i < 21; i++ ) {
            if ( i === 9 ) {
                let plabel = progress.toString();
                if ( progress < 10 ) {
                    plabel = ` ${plabel}`;
                }
                base = replaceAt( base, plabel, i, plabel.length );
                i += plabel.length;
                base = replaceAt( base, '%', i, 1 );

            } else {
                base = i < p ? replaceAt( base, '=', i, 1 ) : base;

            }

        }

        return `[${base}]`;
        // const progress = this.item.progress / 10;
        // const bar = '====================';
        // const barLength = 20;
        // const percent = Math.round( progress * barLength );
        // const percentString = percent.toString().padStart( 2, ' ' );
        // const barString = bar.substring( 0, percent ) + '%' + bar.substring( percent );
        // return `[${barString}%${percentString}==-------]`;
    }

}
