import 'reflect-metadata';

// Trigger package export!
export enum TriggerPackageExportTypes {
    OverlayId = 0,
    AudioFileId = 1,
}

const packageImportOverlayTypeKey = Symbol( 'packageImportOverlayType' );
const packageImportAudioFileTypeKey = Symbol( 'packageImportAudioFileTypeKey' );
const packageImportPropertyDescriptionsKey = Symbol( 'packageImportPropertyDescriptionsKey' );

export function TriggerPackageProperty( propDescriptor: { propertyType: TriggerPackageExportTypes, name?: string, description?: string } ): any {
    return function <T>( target: T, key: string, descriptor: PropertyDescriptor ) {
        if ( propDescriptor.propertyType === TriggerPackageExportTypes.OverlayId ) {
            let properties: string[] = Reflect.getMetadata( packageImportOverlayTypeKey, target );

            if ( properties ) {
                properties.push( key );
            } else {
                properties = [ key ];
                Reflect.defineMetadata( packageImportOverlayTypeKey, properties, target );
            }
        } else if ( propDescriptor.propertyType === TriggerPackageExportTypes.AudioFileId ) {
            let properties: string[] = Reflect.getMetadata( packageImportAudioFileTypeKey, target );

            if ( properties ) {
                properties.push( key );
            } else {
                properties = [ key ];
                Reflect.defineMetadata( packageImportAudioFileTypeKey, properties, target );
            }
        }

        let propertyDescriptions: Record<string, {name?: string, description?: string}> = Reflect.getMetadata( packageImportPropertyDescriptionsKey, target );
        
        if ( propertyDescriptions ) {
            propertyDescriptions[ key ] = { name: propDescriptor.name, description: propDescriptor.description };
        } else {
            propertyDescriptions = {};
            propertyDescriptions[ key ] = { name: propDescriptor.name, description: propDescriptor.description };
            Reflect.defineMetadata( packageImportPropertyDescriptionsKey, propertyDescriptions, target );
        }
    };
}

export class TriggerPackageImportProperties {
    public overlayIds: string[] = [];
    public audioFileIds: string[] = [];
    public propertyDescriptions: Record<string, {name?: string, description?: string}> = {};
}

export function getTriggerOverlayKeys<T>( object: T ): string[] {
    return Reflect.getMetadata( packageImportOverlayTypeKey, object );
}

export function getTriggerOverlayDescriptors<T>( object: T ): Record<string, {name?: string, description?: string}> {
    let fullDescriptors = Reflect.getMetadata( packageImportPropertyDescriptionsKey, object );
    let overlayKeys = getTriggerOverlayKeys( object );
    let overlayDescriptors: Record<string, {name?: string, description?: string}> = {};
    
    overlayKeys.forEach( key => {
        overlayDescriptors[ key ] = fullDescriptors[ key ];
    } );
    
    return overlayDescriptors;
}

export function getPackageImportProperties<T>( object: T ): TriggerPackageImportProperties {
    let result = new TriggerPackageImportProperties();

    let overlayProperties: string[] = Reflect.getMetadata( packageImportOverlayTypeKey, object );
    overlayProperties?.forEach( key => {
        if ( object[ key ] ) {
            result.overlayIds.push( object[ key ] );
        }
    } );
    
    let audioFileProperties: string[] = Reflect.getMetadata( packageImportAudioFileTypeKey, object );
    audioFileProperties?.forEach( key => {
        if ( object[ key ] ) {
            result.audioFileIds.push( object[ key ] );
        }
    } );
    
    result.propertyDescriptions = Reflect.getMetadata( packageImportPropertyDescriptionsKey, object );

    return result;
}
