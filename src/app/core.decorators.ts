import 'reflect-metadata';

// Trigger package export!
export enum TriggerPackageExportTypes {
    OverlayId = 0,
    AudioFileId = 1,
}

const packageImportOverlayTypeKey = Symbol( 'packageImportOverlayType' );
const packageImportAudioFileTypeKey = Symbol( 'packageImportAudioFileTypeKey' );

export function TriggerPackageProperty( propertyType: TriggerPackageExportTypes ): any {
    return function <T>( target: T, key: string, descriptor: PropertyDescriptor ) {
        if ( propertyType === TriggerPackageExportTypes.OverlayId ) {
            let properties: string[] = Reflect.getMetadata( packageImportOverlayTypeKey, target );

            if ( properties ) {
                properties.push( key );
            } else {
                properties = [ key ];
                Reflect.defineMetadata( packageImportOverlayTypeKey, properties, target );
            }
        } else if ( propertyType === TriggerPackageExportTypes.AudioFileId ) {
            let properties: string[] = Reflect.getMetadata( packageImportAudioFileTypeKey, target );

            if ( properties ) {
                properties.push( key );
            } else {
                properties = [ key ];
                Reflect.defineMetadata( packageImportAudioFileTypeKey, properties, target );
            }
        }
    };
}

export class TriggerPackageImportProperties {
    public overlayIds: string[] = [];
    public audioFileIds: string[] = [];
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

    return result;
}
