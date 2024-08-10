import { Component, Input, OnInit } from '@angular/core';
import { OverlayWindowModel, Phrase, TriggerAction } from 'src/app/core.model';

@Component({
  selector: 'app-trigger-action-list',
  templateUrl: './trigger-action-list.component.html',
  styleUrls: ['./trigger-action-list.component.scss']
})
export class TriggerActionListComponent implements OnInit {
    
    @Input( 'action' ) public action: TriggerAction;
    @Input( 'triggerActions' ) public actionOptions: TriggerAction[] = [];
    @Input( 'overlayOptions' ) public timerOverlays: OverlayWindowModel[] = [];
    @Input( 'alertOverlays' ) public alertOverlays: OverlayWindowModel[] = [];
    @Input( 'phrases' ) public phrases: Phrase[] = [];

  constructor() { }

  ngOnInit(): void {
  }

}
