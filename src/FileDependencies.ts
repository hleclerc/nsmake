

/** */
export default
class FileDependencies {
    clear() {
    }

    merge( that: FileDependencies ): void {
        for( let p of that.found )
            this.found.set( p[ 0 ], p[ 1 ] );
        for( let p of that.failed )
            this.failed.add( p );
    }
    
    get pretty(): string {
        let res = new Array<string>();
        this.found .forEach( ( mtime, name ) => res.push( `${ JSON.stringify( name ) }:${mtime}` ) );
        this.failed.forEach( name => res.push( `${ JSON.stringify( name ) }:null` ) );
        return res.join( ',' );
    }

    found  = new Map<string, number>(); /** file => mtime */
    failed = new Set<string>();         /** */
} 
