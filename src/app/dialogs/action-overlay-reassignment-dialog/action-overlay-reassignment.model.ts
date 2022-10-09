import { TriggerModel, TriggerAction, OverlayWindowModel, ActionTypes } from "src/app/core.model";

export class ActionOverlayUseModel {

    trigger: TriggerModel;
    actionId: string;
    overlayKey: string;
    propertyName?: string;
    propertyDesc?: string;
    reassignmentOverlayId?: string;
    actionType: ActionTypes;
}

export class ActionOverlayReviewModel {

    showDeleteWarning: boolean = false;
    hideReassignment: boolean = false;
    overlay?: OverlayWindowModel;

    actionUses: ActionOverlayUseModel[] = [];

}

export class OverlayAssignmentDetail {
    triggerId: string;
    actionId: string;
    overlayKey: string;
    overlayId: string;
}

export class OverlayReassignments {
    
    public actionUses: OverlayAssignmentDetail[] = [];

}
