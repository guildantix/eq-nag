import { TriggerCondition } from "src/app/core.model";

export class NamedGroupConditionsModel {

    public title: string;
    public message: string | string[];
    public conditions: TriggerCondition[];

}