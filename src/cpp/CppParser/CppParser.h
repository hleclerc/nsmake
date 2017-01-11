#ifndef CppParser_H
#define CppParser_H

#include "../System/Parsing.h"
#include "../System/Trie.h"
#include "../Task.h"
#include "Define.h"

#include <unordered_map>
#include <unordered_set>
#include <algorithm>
#include <string.h>
#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <stack>

///
struct CppParser {
    enum { VT_none, VT_NSMAKE_CMD, VT_NSMAKE_RUN, VT_defined, VT_has_include, VT_has_include_next, /*must be the last*/ VT_end_base };
    using MapSPS             = std::unordered_map<std::string,std::tuple<std::string,std::string,int>>; //
    using MapSJV             = std::unordered_map<std::string,Json::Value>; //
    using LineMakersToInsert = std::vector<std::pair<size_t,std::string>>;
    using Defines            = std::unordered_map<unsigned,Define>; // variable num (in trie) => Define
    using StringStringMap    = std::map<std::string,std::string>;
    using StringSet          = std::unordered_set<std::string>; //
    using UnsignedSet        = std::unordered_set<unsigned>; //
    using StringVec          = std::vector<std::string>; //
    using St                 = std::string;

    struct Read {
        Read( unsigned len_block_beg ) : num_inst( 0 ), len_block_beg( len_block_beg ), num_inst_endif( std::numeric_limits<unsigned>::max() ) {}

        int         num_path; // num in include paths that was used to get this
        unsigned    num_read;
        std::string filename;
        Read       *prev;     // prev in stack
        std::string dir;      // orig dir
        const char *lw;       // end of already written data
        const char *b;
        const char *e;

        // stuff to test #ifndef xx #define xx ... #endif
        unsigned    num_inst;
        unsigned    len_block_beg;  ///< blocks.size() at the beginning of the parsing
        std::string ifndef_string;  ///< string after the first ifndef it it's the first inst
        std::string define_string;  ///< string after the first ifndef it it's the second inst
        unsigned    num_inst_endif; ///< num directive of the first endif to close the first block of this Read
    };

    CppParser( Task *task );

    void                 parse              ( const std::string &filename, const std::string &dir, const char *b, const char *e, Read *old_read = 0, bool save = true, int num_path = -1 );
    void                 parse              ( const std::string &filename, const std::string &dir, const std::string &str, Read *old_read = 0, bool save = true, int num_path = -1 );
    void                 _nsmake            ( const char *b, const char *e, Read *read );
    void                 _preprocessor      ( const char *b, const char *e, Read *read );
    void                 _variable          ( unsigned variable_type, const char *b, const char *&e, const char *end, Read *read );
    void                 c_error            ( const std::string &msg, const char *b, Read *read );
    bool                 get_macro_arguments( const char *&b, const char *e, std::vector<std::pair<const char *,const char *>> &arguments, Read *read );
    bool                 skip_inst          () const;
    std::string          substitution       ( const std::string &str, Read *read, const char *od );
    std::string          stringified        ( const std::string &s );
    static int           get_num_path       ( const Read *read );
    bool                 is_system_header   ( const std::string &p ) const;
    bool                 is_in              ( std::string file, const std::string &dir ) const;
    void                 read_rules         ();
    void                 read_base_info     ();
    StringVec            include_try_list   ( std::string cur_dir, std::string launch_dir, std::string basename, unsigned min_num_path );


    void                 _define            ( const char *b, const char *e, Read *read, const char *od );
    void                 _ifdef             ( const char *b, const char *e, Read *read, const char *od, bool neg = false );
    void                 _if                ( const char *b, const char *e, Read *read, const char *od );
    void                 _else              ( Read *read, const char *od );
    void                 _elif              ( const char *b, const char *e, Read *read, const char *od );
    void                 _include           ( const char *b, const char *e, Read *read, const char *od, const char *sd, bool next = false, bool subs_allowed = true );
    void                 _endif             ( Read *read, const char *od );
    void                 _undef             ( const char *b, const char *e, Read *read, const char *od );
    void                 _pragma            ( const char *b, const char *e, Read *read, const char *od );

    void                 write_substitution ( unsigned variable_type, const char *b, const char *&e, const char *end, Read *read );

    struct Block {
        Block( bool cur_ok, bool has_ok, bool sur_ko ) : cur_ok( cur_ok ), has_ok( has_ok ), sur_ko( sur_ko ) {}
        bool ko() const { return sur_ko or not cur_ok; }
        bool cur_ok; //
        bool has_ok; // a cond was ok in the current #if #elif* #else? #endif set
        bool sur_ko; // if parent block was ko
        bool __;
    };

    UnsignedSet          macros_with_nsmake_cmd;
    LineMakersToInsert   linemakers_to_insert;
    StringVec            base_include_paths;
    StringVec            cmd_include_paths;
    Trie                 special_variables;
    unsigned             num_special_var;
    bool                 need_cpp_dump;
    StringStringMap      can_be_skiped;
    MapSPS               include_cache;
    StringSet            pragma_onced;
    StringSet            include_strs;
    std::string          cpp_content;
    MapSJV               inc_rules;   ///< what to do if a given file is included
    std::string          cxx_name;    ///< from nsmake cmd
    std::string          ld_name;     ///< from nsmake cmd
    std::string          ar_name;     ///< from nsmake cmd
    StringSet            includes;
    Defines              defines;
    std::stack<Block>    blocks;
    Task                *task;

    // output
    StringVec            inc_paths;
    StringVec            cpp_flags;
    StringVec            c_flags  ;
    StringVec            lib_paths;
    StringVec            lib_names;
    StringVec            obj_names;
};

#endif // CppParser_H
