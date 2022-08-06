import { Component, ElementRef, Input, OnInit } from '@angular/core';
import { nagId } from 'src/app/core/nag-id.util';

@Component( {
    selector: 'app-accordion-panel',
    templateUrl: 'accordion-panel.component.html',
    styleUrls: [ 'accordion-panel.component.scss' ],
    host: {'class': 'accordion-panel'}
} )
export class AccordionPanelComponent implements OnInit {

    public id: string = nagId();
    @Input() public label: string = '';

    constructor() { }

    ngOnInit() { }

}
