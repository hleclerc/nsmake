#include "ErrorDisp.h"
// #include "Print.h"
#include <string.h>

namespace {

static bool term_supports_color() {
    const char *term = getenv( "TERM" );
    return term and strcmp( term, "dumb" );
}

static void display_line( std::ostream &os, const char *complete_line, unsigned length_complete_line, int col, bool display_col ) {
    if ( display_col )
        os << "  ";
    if ( length_complete_line < 64 ) {
        os.write(complete_line,length_complete_line);
        if ( display_col ) {
            os << "\n";
            for ( int i = 1;i < 2 + col;++i )
                os << " ";
        }
    } else {
        if ( length_complete_line - col < 64 ) { // only the ending
            os << "...";
            os.write( complete_line + length_complete_line - 64, 64 );
            if ( display_col ) {
                os << "\n";
                for ( unsigned i = 1;i < 2 + 64 + 3 - length_complete_line + col;++i )
                    os << " ";
            }
        } else if ( col < 64 ) { // only the beginning
            os.write( complete_line, 64 );
            os << "...";
            if ( display_col ) {
                os << "\n";
                for ( int i = 1;i < 2 + col;++i )
                    os << " ";
            }
        } else { // middle
            os << "...";
            os.write( complete_line + col - 32, 61 );
            os << "...";
            if ( display_col ) {
                os << "\n";
                for ( int i = 1;i < 2 + 32 + 3;++i )
                    os << " ";
            }
        }
    }
    if ( display_col )
        os << "^";
}

}

ErrorDisp::Provenance::Provenance( const char *beg, const char *end, const char *pos, std::string provenance, std::string msg ) : provenance( provenance ), msg( msg ) {
    _init( beg, end, pos );
}

ErrorDisp::Provenance::Provenance( int line, std::string provenance ) : provenance( provenance ), line( line ) {
    col = -1;
}

void ErrorDisp::Provenance::_init( const char *beg, const char *end, const char *pos ) {
    if ( not pos ) {
        col  = 0;
        line = 0;
        return;
    }

    const char *b = pos, *e = pos;
    while ( b > beg and b[ -1 ] != '\n' and b[ -1 ] != '\r' )
        --b;
    while ( e < end and *e != '\n' and *e != '\r' )
        ++e;

    complete_line = { b, e };

    col = pos - b + 1;
    line = 1;
    for ( b = pos; b >= beg; --b )
        line += ( *b == '\n' );
}

ErrorDisp::ErrorDisp( const std::string &msg ) : msg( msg ) {
    display_escape_sequences = term_supports_color();
    display_col              = true;
    warn                     = false;
}

void ErrorDisp::write_to_stream( std::ostream &os ) const {
    // last item in caller stack
    if ( caller_stack.size() ) {
        if ( display_escape_sequences )
            os << "\033[1m";
        const ErrorDisp::Provenance &po = caller_stack[ 0 ];
        if ( po.provenance.size() )
            os << po.provenance << ":";
        if ( po.line ) {
            os << po.line;
            if ( po.col > 0 )
                os << ":" << po.col;
            os << ": ";
        }
        os << "error: " << msg << ( display_col ? "\n" : " in '" );
        if ( po.complete_line.size() )
            display_line( os, po.complete_line.c_str(), po.complete_line.size(), po.col, display_col );
        os << ( display_col ? "\n" : "'\n" );
        if ( display_escape_sequences )
            os << "\033[0m";
    }
    else {
        if ( display_escape_sequences )
            os << "\033[1m";
        os << "error: " << msg << "\n";
        if ( display_escape_sequences )
            os << "\033[0m";
    }

    // caller_stack
    for( unsigned num_prov = 1; num_prov < caller_stack.size(); ++num_prov ) {
        const ErrorDisp::Provenance &po = caller_stack[ num_prov ];
        if ( po.provenance.size() )
            os << po.provenance << ":";
        if ( po.line ) {
            os << po.line << ":" << po.col;
            //while ( num_prov>0 and error.caller_stack[ num_prov-1 ].line==po.line ) os << "," << error.caller_stack[ --num_prov ].col;
            os << ": ";
        }
        os << "instantiated from: ";
        display_line( os, po.complete_line.c_str(), po.complete_line.size(), po.col, false );
        os << "\n";
    }

    // possibilities
    if ( possibilities.size() ) {
        os << "Possibilities are:" << std::endl;
        for ( unsigned i = 0; i < possibilities.size();++i ) {
            for( unsigned j = 0; ; ++j ) {
                if ( j == i ) {
                    const ErrorDisp::Provenance & po = possibilities[ i ];
                    if ( po.provenance.size() and po.line )
                        os << "" << po.provenance << ":" << po.line << ":" << po.col << ": ";
                    else
                        os << "(in primitive functions or classes)";
                    if ( po.msg.size() )
                        os << po.msg << ": ";
                    display_line( os, po.complete_line.c_str(), po.complete_line.size(), po.col, false );
                    os << "\n";
                    break;
                }
                if ( possibilities[i].provenance == possibilities[j].provenance and
                     possibilities[i].line == possibilities[j].line and
                     possibilities[i].col  == possibilities[j].col )
                    break;
            }
        }
    }
}

ErrorDisp &ErrorDisp::ac( const char *beg, const char *end, const char *pos, std::string provenance ) {
    caller_stack.emplace_back( beg, end, pos, provenance );
    return *this;
}

ErrorDisp &ErrorDisp::ap( const char *beg, const char *end, const char *pos, std::string provenance, std::string msg ) {
    possibilities.emplace_back( beg, end, pos, provenance, msg );
    return *this;
}
