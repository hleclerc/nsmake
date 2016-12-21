
/** */
export interface SystemInfo {
    os      : string;
    dist    : string;
    codename: string;
    release : number;
}

/** */
export function is_compatible_with( sys: SystemInfo, lst: Array<string> ) {
    if ( ! lst || lst.length == 0 )
        return true;
    for( const str of lst ) {
        const spl = str.match( />=|>|<=|<|==|[^>=<]+/g ).map( x => x.trim() );
        if ( spl.length == 0 )
            continue;
        if ( spl[ 0 ] != sys.os && spl[ 0 ] != sys.dist )
            continue;
        let ok = true;
        for( let i = 1; i < spl.length; i += 2 ) {
            switch ( spl[ i ] ) {
                case "==": if ( sys.release != Number( spl[ i + 1 ] ) ) ok = false; break;
                case ">=": if ( sys.release <  Number( spl[ i + 1 ] ) ) ok = false; break;
                case "<=": if ( sys.release >  Number( spl[ i + 1 ] ) ) ok = false; break;
                case ">" : if ( sys.release <= Number( spl[ i + 1 ] ) ) ok = false; break;
                case "<" : if ( sys.release >= Number( spl[ i + 1 ] ) ) ok = false; break;
            }
        }
        if ( ok )
            return true;
    }
    return false;
}
