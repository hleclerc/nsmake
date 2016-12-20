#pragma once

#include <iostream>
#include <stdint.h>
#include <vector>
#include <stack>

/**
*/
class CppPreprocParser {
public:
    using ST = int64_t;
    using Error = std::pair<std::string,unsigned>;

    bool               parse          ( const char *beg, const char *end );
    void               write_to_stream( std::ostream &os ) const;
    ST                 eval           () const;

    std::vector<Error> errors;

protected:

    struct AstData {
        // operators
        enum {
            /*  0 */ LFT_PAR, RGT_PAR, NUMBER , ADD_UNA, SUB_UNA, NOT_LOG, NOT_BIN, MUL      , DIV  , MOD       ,
            /* 10 */ ADD    , SUB    , SHL    , SHR    , INF    , INF_EQ , SUP    , SUP_EQ   , EQU  , NEQ       ,
            /* 20 */ AND_BIN, XOR_BIN, OR_BIN , AND_LOG, OR_LOG , DBL_DOT, QUESTION, VARIABLE, COMMA, PLACEMAKER,
            /* 30 */ BASE
        };
        // groups
        enum {
            GRP_ADD_UNA    =  1, GRP_SUB_UNA =  1, GRP_NOT_LOG =  1, GRP_NOT_BIN = 1,
            GRP_MUL        =  2, GRP_DIV     =  2, GRP_MOD     =  2,
            GRP_ADD        =  3, GRP_SUB     =  3,
            GRP_SHL        =  4, GRP_SHR     =  4,
            GRP_INF        =  5, GRP_INF_EQ  =  5, GRP_SUP     =  5, GRP_SUP_EQ  = 5,
            GRP_EQU        =  6, GRP_NEQ     =  6,
            GRP_AND_BIN    =  7,
            GRP_XOR_BIN    =  8,
            GRP_OR_BIN     =  9,
            GRP_AND_LOG    = 10,
            GRP_OR_LOG     = 11,
            GRP_DBL_DOT    = 12, GRP_QUESTION = 12,
            nb_grp         = 13
        };

        // behavior
        enum {
            need_none = 0, need_larg = 1, need_rarg = 2, need_barg = 3
        };

        int behavior( int grp );

        struct Node {
            Node( int type, ST val = 0, std::string &&str = {} ) : children{ 0, 0 }, prev_grp( 0 ), parent{ 0 }, prev( 0 ), next( 0 ), type( type ), val( val ), str( std::move( str ) ), arg( -1 ) {}

            void        write_to_stream( std::ostream &os, int par_grp = 100 ) const;
            ST          eval           () const;
            Node       *get_last       ();
            Node       *copy           ();

            Node       *children[ 2 ];
            Node       *prev_grp;
            Node       *parent;
            Node       *prev;
            Node       *next;
            int         type;
            int         grp;
            ST          val;
            std::string str;
            int         arg; ///< num argument in macro definition
        };

        AstData();

        void               reg           ( Node *node, int group );
        bool               err           ( Node *o, const std::string &msg );
        bool               assemble_barg ( Node *o, int need_left, int need_right );
        bool               assemble_rarg ( Node *o );
        bool               assemble_larg ( Node *o );
        bool               make_hierarchy();
        ST                 eval          () const;
        static std::string op_string     ( int num );

        Node               base;
        Node              *last;
        Node              *by_grp[ nb_grp ];
        const char        *beg;
        const char        *end;
        CppPreprocParser  *cpp;
    };

    #include "CppPreprocParser.hpipe.h"

    HpipeData   hpipe_data;
    AstData     ast_data;
    ST          num;
};
