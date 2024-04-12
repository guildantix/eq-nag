
export function replaceAt( value: string, char: string, index: number, length: number ): string {
    return value.substring( 0, index ) + char + value.substring( index + length );
}