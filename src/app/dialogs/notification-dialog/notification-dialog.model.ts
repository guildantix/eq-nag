import { ColoredString } from "../dialog.model";

export class NotificationDialogModel {
    public title: string;
    public message: string | ( string | ColoredString )[];
    public notificationType: NotificationTypes;
    public icon: string;
}

export enum NotificationTypes {
    Error,
    Information,
    Warning,
    Custom,
}
