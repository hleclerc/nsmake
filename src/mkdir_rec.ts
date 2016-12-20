import * as path from 'path';
import * as fs   from 'fs';

export
function mkdir_rec( dir: string, cb: ( err: NodeJS.ErrnoException ) => void ) {
    if ( ! dir )
        return cb( null );
    fs.exists( dir, exists => {
        if ( exists )
            return cb( null );
        mkdir_rec( path.dirname( dir ), err => {
            if ( err ) return cb( err );
            fs.mkdir( dir, cb );
        } );
    } );
}

export
function mkdir_rec_sync( dir: string ) {
    if ( dir && ! fs.existsSync( dir ) ) {
        let p = path.dirname( dir );
        if ( p != dir )
            mkdir_rec_sync( p );
        fs.mkdirSync( dir );
    }
}
