/*
echo -e "Normal \e[4mUnderlined"
echo -e "Normal \e[5mBlink"
echo -e "Normal \e[7minverted"

echo -e "Default \e[31mRed"
echo -e "Default \e[32mGreen"
echo -e "Default \e[33mYellow"
echo -e "Default \e[34mBlue"
echo -e "Default \e[37mLight gray"
echo -e "Default \e[90mDark gray"
 */
function esc_seq_beg( dc: boolean, level: number ): string {
    if ( dc ) {
        switch( level ) {
        case 0: return "\u001b[90m";
        case 1: return "\u001b[32m";
        case 3: return "\u001b[1m";
        }
    }
    return "";
}
function esc_seq_end( dc: boolean, level: number ): string {
    if ( dc ) {
        switch( level ) {
        case 0:
        case 1:
        case 3: return "\u001b[0m";
        }
    }
    return "";
}

/** 
 * 
 */
export default 
class Pager {
    /** level 0: title/annoucement, 1: note, 2: information, 3: error */
    write( sig: string, msg: string, level: number ) {
        const p = level >= 3 ? process.stderr : process.stdout;
        process.stdout.write( esc_seq_beg( p.isTTY, level ) + msg + esc_seq_end( p.isTTY, level ) );
    }

    /** */
    close( sig: string ) {

    }

    /** */
    close_all() {

    }
}
