import { Component, OnInit } from '@angular/core';

@Component( {
    selector: 'app-debug-console',
    templateUrl: 'debug-console.component.html',
    styleUrls: [ 'debug-console.component.scss' ],
} )
export class DebugConsoleComponent implements OnInit {

    public show: boolean = false;
    public showInput: boolean = false;

    constructor() { }

    ngOnInit() { }

}
