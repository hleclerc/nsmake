import * as rimraf from "rimraf";
import * as crypto from "crypto";
import * as path   from "path";
import * as fs     from "fs";

function md5( str ) {
    return crypto.createHash( 'md5' ).update( str ).digest( "hex" );
}

function mkdir_rec( dir : string ) {
    if ( ! fs.existsSync( dir ) ) {
        let p = path.dirname( dir );
        if ( p != dir )
            mkdir_rec( p );
        fs.mkdirSync( dir );
    }
}

export default
class Db {
    constructor( dir ) {
        this.dir = dir;
        this.init();
    }

    // callback( err, value: string )
    get( key: string, callback, _num = 0 ) : void {
        fs.readFile( `${ this.dir }/${ md5( key ) }_${ _num }.cmd`, ( err, content: Buffer ) => {
            if ( err )
                return callback( { notFound: true }, undefined );
            const ind = content.indexOf( '\n' ), f_key = content.slice( 0, ind ).toString( 'utf8' );
            if ( f_key != key )
                return this.get( key, callback, ++_num );
            callback( null, content.slice( ind + 1 ).toString( 'utf8' ) );
        } );
    }

    // callback( err )
    put( key: string, value: string, callback, _num = 0 ) : void {
        const fn = `${ this.dir }/${ md5( key ) }_${ _num }.cmd`;
        fs.readFile( fn, ( err, content: Buffer ) => {
            if ( err )
                return fs.writeFile( fn, key + "\n" + value, callback );
            const ind = content.indexOf( '\n' ), f_key = content.slice( 0, ind ).toString( 'utf8' );
            if ( f_key != key )
                return this.put( key, value, callback, ++_num );
            fs.writeFile( fn, key + "\n" + value, callback );
        } );
    }

    //
    clean( done ) {
        try {
            rimraf( this.dir, err => {
                done();
            } );
        } catch ( e ) {
        }
    }

    init() {
        mkdir_rec( this.dir );
    }

    dir : string;
}

// // levelup version
// var leveldown = require( "leveldown" );
// var levelup   = require( "levelup" );
//
// export default
// class Db {
//     constructor( dir ) {
//         this.dir = dir;
//         this.init();
//     }
//
//     // callback( err, value )
//     get( key, callback ) {
//         this.inst.get( key, callback );
//     }
//
//     // callback( err )
//     put( key, value, callback ) {
//         this.inst.put( key, value, callback );
//     }
//
//     //
//     clean( done ) {
//         leveldown.destroy( `${ this.dir }/commands`, done );
//         init();
//     }
//
//     init() {
//         this.inst = levelup( `${ this.dir }/commands` );
//     }
//
//     dir : string;
//     inst: any; // levelup
// }
