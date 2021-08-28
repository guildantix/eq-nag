import { Component, ViewChild, ElementRef, NgZone } from '@angular/core';
import * as _ from 'lodash-es';
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';

@Component( {
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: [ './app.component.scss' ],
} )
export class AppComponent {

    constructor() {}

    title = 'electron-angular-eq-parse';
}
