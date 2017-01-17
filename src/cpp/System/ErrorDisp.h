#pragma once

#include <iostream>
#include <vector>
#include <string>

class ErrorDisp {
public:
    struct Provenance {
        Provenance( const char *beg, const char *end, const char *pos, std::string provenance, std::string msg = "" );
        Provenance( int line, std::string provenance );

        void _init( const char *beg, const char *end, const char *pos );

        std::string provenance; /// name of file
        std::string complete_line;
        int         line;
        int         col;
        std::string msg;
    };

    ErrorDisp( const std::string &msg, bool display_escape_sequences = true );

    void                    write_to_stream( std::ostream &os ) const;
    ErrorDisp              &ac             ( const char *beg, const char *end, const char *pos, std::string provenance ); ///< add a caller
    ErrorDisp              &ap             ( const char *beg, const char *end, const char *pos, std::string provenance, std::string msg = "" ); ///< add a possibility

    bool                    display_col, display_escape_sequences, warn;
    std::vector<Provenance> caller_stack;  /// "copy" of caller stack
    std::vector<Provenance> possibilities; /// if ambiguous overload, list of possible functions
    std::string             msg;
};
