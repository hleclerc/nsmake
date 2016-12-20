
/** push unique */
export function pu( lst: Array<string|number>, ...to_add: string[] ) {
    for( const v of to_add )
        if ( lst.findIndex( x => typeof x == "string" && x == v ) < 0 )
            lst.push( v );
}
