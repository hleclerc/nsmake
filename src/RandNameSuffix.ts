import * as crypto              from 'crypto';

/** random part for tmp filenames */
export default
class RandNameSuffix {
    val(): string {
        switch ( this.phase ) {
            case 0: return "";
            case 1: return "-" + this.cpt.toString();
            case 2: return "-" + RandNameSuffix.rand( 3 );
            case 3: return "-" + RandNameSuffix.rand( 10 );
        }
    }

    next(): void {
        switch ( this.phase ) {
            case 0: this.phase = 1; break;
            case 1: if ( ++this.cpt >= 10 ) { this.phase = 2; this.cpt = 0; } break;
            case 2: if ( ++this.cpt >= 100 ) { this.phase = 3; this.cpt = 0; } break;
            case 3: break;
        }
    }

    /** random string of length l
     * adapted from http://blog.tompawlak.org/how-to-generate-random-values-nodejs-javascript
     */
    static rand( l: number ): string {
        const url_comp_chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        let buff = null as Buffer;
        try {
            buff = crypto.randomBytes( l );
        } catch ( e ) {
            buff = crypto.pseudoRandomBytes( l );
        }

        let res = "";
        buff.forEach( i => res += url_comp_chars[ i % url_comp_chars.length ] );
        return res;
    }

    phase = 0;
    cpt   = 0;
}

