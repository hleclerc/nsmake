import * as async from "async";
import * as path  from "path";
import * as fs    from "fs";

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

    /** test if some files have changed/appeared/... */
    test( has_change_cb: ( has_change: boolean ) => void ): void {
        async.forEach( [ ...this.failed.keys() ], ( name: string, cb: ( err: boolean ) => void ) => {
            fs.exists( name, exists => cb( exists ) );
        }, ( err ) => {
            if ( err )
                return has_change_cb( true );
            async.forEach( [ ...this.found.keys() ], ( name: string, cb: ( err: boolean ) => void ) => {
                fs.stat( name, ( err, stats ) => {
                    cb( Boolean( err ) || stats.mtime.getTime() != this.found.get( name ) );
                } );
            }, has_change_cb );
        } );
    }

    /** get a list of files to be watched to get a not-too-falsy-positive signal (to call this.test) */    
    get_to_be_watched( watcher_list_cb: ( watcher_list: Set<string> ) => void ): void {
        let not_found = this.failed, watcher_list = new Set<string>();
        async.forever( cb_test => {
            // we continue if some the names are still not on the filesystem 
            let new_not_found = new Set<string>();
            async.forEach( [ ...not_found ], ( name, cb_some ) => {
                fs.exists( name, exists => {
                    if ( exists )
                        watcher_list.add( name );
                    else if ( ! watcher_list.has( path.dirname( name ) ) )
                        new_not_found.add( path.dirname( name ) );
                    cb_some( null );
                } );
            }, err => {
                not_found = new_not_found;
                cb_test( new_not_found.size == 0 );
            } );
        }, err => {
            // add found files
            for( const name of this.found.keys() ) {
                watcher_list.add( path.dirname( name ) ); // moved file with the same inode may not emit a notification if we don't do this
                watcher_list.add( name );
            }
            // done
            watcher_list_cb( watcher_list );
        } );
    }

    /** */
    untangle() {
        this.found.forEach( ( val, name ) => {
            this.failed.delete( name );
        } );
    }

    found  = new Map<string, number>(); /** file => mtime */
    failed = new Set<string>();         /** */
} 
