export class NotificationDialogModel {
    public title: string;
    public message: string | string[];
    public notificationType: NotificationTypes;
}

export enum NotificationTypes {
    Error,
    Information,
    Warning,
}
