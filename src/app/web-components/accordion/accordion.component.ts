import { Component, ElementRef, OnInit } from '@angular/core';

@Component( {
    selector: 'app-accordion',
    templateUrl: 'accordion.component.html',
    styleUrls: [ 'accordion.component.scss' ],
    host: {'class': 'accordion'}
} )
export class AccordionComponent implements OnInit {

    constructor() { }

    ngOnInit() { }

}
