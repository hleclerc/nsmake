// constants
static const unsigned RET_CONT      = 0;
static const unsigned RET_OK        = 1;
static const unsigned RET_KO        = 2;
static const unsigned RET_ENDED_OK  = 3;
static const unsigned RET_ENDED_KO  = 4;
static const unsigned RET_STOP_CONT = 5;
struct HpipeData {
    std::string res;
};
unsigned parse( HpipeData *sipe_data, const unsigned char *data, const unsigned char *end_m1 ) {
    unsigned char save[ 2 ];
    if ( data > end_m1 ) goto l_22;
  l_2:
    if ( data[ 0 ] == ':' ) goto l_18;
    if ( data[ 0 ] == '!' ) goto l_48;
    if ( data[ 0 ] == '<' ) goto l_47;
    if ( data[ 0 ] == '#' ) goto l_44;
  l_40:
    if ( data[ 0 ] == '=' ) goto l_63;
  l_49:
    if ( data[ 0 ] == '>' ) goto l_43;
    if ( data[ 0 ] == '%' ) goto l_39;
    if ( data[ 0 ] == '?' ) goto l_38;
    if ( data[ 0 ] == '&' ) goto l_37;
    if ( data[ 0 ] == '(' ) goto l_23;
    if ( data[ 0 ] == ')' ) goto l_20;
    if ( data[ 0 ] == '*' ) goto l_24;
    if ( data[ 0 ] == '+' ) goto l_34;
    if ( data[ 0 ] == '^' ) goto l_33;
    if ( data[ 0 ] == ',' ) goto l_32;
    if ( data[ 0 ] == '-' ) goto l_31;
    if ( data[ 0 ] == '/' ) goto l_25;
    if ( data[ 0 ] == '0' ) goto l_26;
    if ( data[ 0 ] <= '0' ) goto l_4;
    if ( data[ 0 ] <= ':' ) goto l_14;
    if ( data[ 0 ] == '|' ) goto l_10;
    if ( data[ 0 ] == '~' ) goto l_7;
    if ( data[ 0 ] <= '@' ) goto l_4;
    if ( data[ 0 ] <= 'Z' ) goto l_27;
    if ( data[ 0 ] <= '`' ) goto l_73;
  l_28:
    if ( data[ 0 ] >= '{' ) goto l_4;
  l_27:
    sipe_data->res.clear();
  l_1:
    sipe_data->res += *data;
    if ( data >= end_m1 ) goto l_74;
    ++data;
    if ( data[ 0 ] == '!' ) goto l_75;
    if ( data[ 0 ] == '<' ) goto l_76;
    if ( data[ 0 ] == '#' ) goto l_77;
    if ( data[ 0 ] == '=' ) goto l_78;
    if ( data[ 0 ] == '>' ) goto l_79;
    if ( data[ 0 ] == '%' ) goto l_80;
    if ( data[ 0 ] == '?' ) goto l_81;
    if ( data[ 0 ] == '&' ) goto l_82;
    if ( data[ 0 ] == '(' ) goto l_83;
    if ( data[ 0 ] == ')' ) goto l_84;
    if ( data[ 0 ] == '*' ) goto l_85;
    if ( data[ 0 ] == '+' ) goto l_86;
    if ( data[ 0 ] == '^' ) goto l_87;
    if ( data[ 0 ] == ',' ) goto l_88;
    if ( data[ 0 ] == '-' ) goto l_89;
    if ( data[ 0 ] == '/' ) goto l_90;
    if ( data[ 0 ] == ':' ) goto l_91;
    if ( data[ 0 ] == '|' ) goto l_92;
    if ( data[ 0 ] == '~' ) goto l_93;
    if ( data[ 0 ] <= '/' ) goto l_3;
    if ( data[ 0 ] == '_' ) goto l_1;
    if ( data[ 0 ] <= ':' ) goto l_1;
    if ( data[ 0 ] >= 'a' ) goto l_94;
    if ( data[ 0 ] <= '@' ) goto l_3;
    if ( data[ 0 ] <= 'Z' ) goto l_1;
  l_3:
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
  l_4:
    if ( data >= end_m1 ) goto l_22;
    ++data;
    goto l_2;
  l_22:
    return RET_OK;
  l_94:
    if ( data[ 0 ] <= 'z' ) goto l_1;
    goto l_3;
  l_93:
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
  l_7:
    { ast_data.reg( new AstData::Node( AstData::NOT_BIN ), AstData::GRP_NOT_BIN ); }
    goto l_4;
  l_92:
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
  l_10:
    if ( data >= end_m1 ) goto l_95;
    ++data;
    if ( data[ 0 ] == ':' ) goto l_96;
    if ( data[ 0 ] == '!' ) goto l_97;
    if ( data[ 0 ] == '<' ) goto l_98;
    if ( data[ 0 ] == '#' ) goto l_99;
    if ( data[ 0 ] == '=' ) goto l_100;
    if ( data[ 0 ] == '>' ) goto l_101;
    if ( data[ 0 ] == '%' ) goto l_102;
    if ( data[ 0 ] == '?' ) goto l_103;
    if ( data[ 0 ] == '&' ) goto l_104;
    if ( data[ 0 ] == '(' ) goto l_105;
    if ( data[ 0 ] == ')' ) goto l_106;
    if ( data[ 0 ] == '*' ) goto l_107;
    if ( data[ 0 ] == '+' ) goto l_108;
    if ( data[ 0 ] == '^' ) goto l_109;
    if ( data[ 0 ] == ',' ) goto l_110;
    if ( data[ 0 ] == '-' ) goto l_111;
    if ( data[ 0 ] == '/' ) goto l_112;
    if ( data[ 0 ] == '0' ) goto l_113;
    if ( data[ 0 ] <= '0' ) goto l_6;
    if ( data[ 0 ] <= ':' ) goto l_114;
    if ( data[ 0 ] == '|' ) goto l_115;
    if ( data[ 0 ] == '~' ) goto l_116;
    if ( data[ 0 ] <= '@' ) goto l_6;
    if ( data[ 0 ] <= 'Z' ) goto l_5;
    if ( data[ 0 ] <= '`' ) goto l_117;
    if ( data[ 0 ] >= '{' ) goto l_6;
  l_5:
    { ast_data.reg( new AstData::Node( AstData::OR_BIN ), AstData::GRP_OR_BIN ); }
    sipe_data->res.clear();
    goto l_1;
  l_6:
    { ast_data.reg( new AstData::Node( AstData::OR_BIN ), AstData::GRP_OR_BIN ); }
    goto l_4;
  l_117:
    if ( data[ 0 ] <= '`' and data[ 0 ] != '_' ) goto l_6;
    goto l_5;
  l_116:
    { ast_data.reg( new AstData::Node( AstData::OR_BIN ), AstData::GRP_OR_BIN ); }
    goto l_7;
  l_115:
    { ast_data.reg( new AstData::Node( AstData::OR_LOG ), AstData::GRP_OR_LOG ); }
    goto l_4;
  l_114:
    { ast_data.reg( new AstData::Node( AstData::OR_BIN ), AstData::GRP_OR_BIN ); }
  l_14:
    { num =            *data - '0'; }
  l_11:
    if ( data >= end_m1 ) goto l_118;
    ++data;
    if ( data[ 0 ] == '<' ) goto l_119;
    if ( data[ 0 ] == '!' ) goto l_120;
    if ( data[ 0 ] == '=' ) goto l_121;
    if ( data[ 0 ] == '>' ) goto l_122;
    if ( data[ 0 ] == '#' ) goto l_123;
    if ( data[ 0 ] == '?' ) goto l_124;
    if ( data[ 0 ] == '%' ) goto l_53;
    if ( data[ 0 ] == '&' ) goto l_54;
    if ( data[ 0 ] == '(' ) goto l_55;
    if ( data[ 0 ] == ')' ) goto l_56;
    if ( data[ 0 ] == '*' ) goto l_57;
    if ( data[ 0 ] == '+' ) goto l_58;
    if ( data[ 0 ] == ',' ) goto l_59;
    if ( data[ 0 ] == '-' ) goto l_60;
    if ( data[ 0 ] == '^' ) goto l_64;
    if ( data[ 0 ] == '/' ) goto l_19;
    if ( data[ 0 ] <= '/' ) goto l_8;
    if ( data[ 0 ] <= '9' ) goto l_69;
    if ( data[ 0 ] == ':' ) goto l_21;
    if ( data[ 0 ] == '|' ) goto l_50;
    if ( data[ 0 ] == '~' ) goto l_51;
    if ( data[ 0 ] == '_' ) goto l_9;
    if ( data[ 0 ] <= '@' ) goto l_8;
    if ( data[ 0 ] <= 'K' ) goto l_9;
    if ( data[ 0 ] <= '`' ) goto l_62;
  l_52:
    if ( data[ 0 ] >= '{' ) goto l_8;
  l_9:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    sipe_data->res.clear();
    goto l_1;
  l_8:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_4;
  l_62:
    if ( data[ 0 ] == 'L' ) goto l_8;
    if ( data[ 0 ] >= '[' ) goto l_8;
    goto l_9;
  l_51:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_7;
  l_50:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_10;
  l_21:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
  l_18:
    { ast_data.reg( new AstData::Node( AstData::DBL_DOT ), AstData::GRP_DBL_DOT ); }
    goto l_4;
  l_69:
    { num = 10 * num + *data - '0'; }
    goto l_11;
  l_19:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
  l_25:
    if ( data >= end_m1 ) goto l_125;
    ++data;
    if ( data[ 0 ] == ':' ) goto l_126;
    if ( data[ 0 ] == '!' ) goto l_127;
    if ( data[ 0 ] == '<' ) goto l_128;
    if ( data[ 0 ] == '#' ) goto l_129;
    if ( data[ 0 ] == '=' ) goto l_130;
    if ( data[ 0 ] == '>' ) goto l_131;
    if ( data[ 0 ] == '%' ) goto l_132;
    if ( data[ 0 ] == '?' ) goto l_133;
    if ( data[ 0 ] == '&' ) goto l_134;
    if ( data[ 0 ] == '(' ) goto l_135;
    if ( data[ 0 ] == ')' ) goto l_136;
    if ( data[ 0 ] == '*' ) goto l_71;
    if ( data[ 0 ] == '+' ) goto l_137;
    if ( data[ 0 ] == '^' ) goto l_138;
    if ( data[ 0 ] == ',' ) goto l_139;
    if ( data[ 0 ] == '-' ) goto l_140;
    if ( data[ 0 ] == '/' ) goto l_70;
    if ( data[ 0 ] == '0' ) goto l_141;
    if ( data[ 0 ] <= '0' ) goto l_13;
    if ( data[ 0 ] <= ':' ) goto l_142;
    if ( data[ 0 ] == '|' ) goto l_143;
    if ( data[ 0 ] == '~' ) goto l_144;
    if ( data[ 0 ] <= '@' ) goto l_13;
    if ( data[ 0 ] <= 'Z' ) goto l_12;
    if ( data[ 0 ] <= '`' ) goto l_145;
    if ( data[ 0 ] >= '{' ) goto l_13;
  l_12:
    { ast_data.reg( new AstData::Node( AstData::DIV ), AstData::GRP_DIV ); }
    sipe_data->res.clear();
    goto l_1;
  l_13:
    { ast_data.reg( new AstData::Node( AstData::DIV ), AstData::GRP_DIV ); }
    goto l_4;
  l_145:
    if ( data[ 0 ] <= '`' and data[ 0 ] != '_' ) goto l_13;
    goto l_12;
  l_144:
    { ast_data.reg( new AstData::Node( AstData::DIV ), AstData::GRP_DIV ); }
    goto l_7;
  l_143:
    { ast_data.reg( new AstData::Node( AstData::DIV ), AstData::GRP_DIV ); }
    goto l_10;
  l_142:
    { ast_data.reg( new AstData::Node( AstData::DIV ), AstData::GRP_DIV ); }
    goto l_14;
  l_141:
    { ast_data.reg( new AstData::Node( AstData::DIV ), AstData::GRP_DIV ); }
  l_26:
    save[ 0 ] = *data;
    if ( data >= end_m1 ) goto l_146;
    ++data;
    if ( data[ 0 ] == '=' ) goto l_147;
    if ( data[ 0 ] == '<' ) goto l_148;
    if ( data[ 0 ] == '>' ) goto l_149;
    if ( data[ 0 ] == '!' ) goto l_150;
    if ( data[ 0 ] == '?' ) goto l_151;
    if ( data[ 0 ] == '#' ) goto l_152;
    if ( data[ 0 ] == '%' ) goto l_153;
    if ( data[ 0 ] == '&' ) goto l_154;
    if ( data[ 0 ] == '(' ) goto l_155;
    if ( data[ 0 ] == ')' ) goto l_156;
    if ( data[ 0 ] == '*' ) goto l_157;
    if ( data[ 0 ] == '+' ) goto l_158;
    if ( data[ 0 ] == '^' ) goto l_159;
    if ( data[ 0 ] == ',' ) goto l_160;
    if ( data[ 0 ] == '-' ) goto l_161;
    if ( data[ 0 ] == '/' ) goto l_162;
    if ( data[ 0 ] <= '/' ) goto l_16;
    if ( data[ 0 ] <= '9' ) goto l_163;
    if ( data[ 0 ] == ':' ) goto l_164;
    if ( data[ 0 ] == 'x' ) goto l_165;
    if ( data[ 0 ] == '|' ) goto l_166;
    if ( data[ 0 ] == '~' ) goto l_167;
    if ( data[ 0 ] >= 'a' ) goto l_168;
    if ( data[ 0 ] <= '@' ) goto l_16;
    if ( data[ 0 ] <= 'K' ) goto l_15;
    if ( data[ 0 ] == '_' ) goto l_15;
    if ( data[ 0 ] == 'L' ) goto l_16;
    if ( data[ 0 ] >= '[' ) goto l_16;
  l_15:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    sipe_data->res.clear();
    goto l_1;
  l_16:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_4;
  l_168:
    if ( data[ 0 ] >= '{' ) goto l_16;
    goto l_15;
  l_167:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_7;
  l_166:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_10;
  l_165:
    save[ 1 ] = *data;
    if ( data >= end_m1 ) goto l_169;
    ++data;
    if ( data[ 0 ] == '<' ) goto l_170;
    if ( data[ 0 ] == '!' ) goto l_171;
    if ( data[ 0 ] == '=' ) goto l_172;
    if ( data[ 0 ] == '>' ) goto l_173;
    if ( data[ 0 ] == '#' ) goto l_174;
    if ( data[ 0 ] == '?' ) goto l_175;
    if ( data[ 0 ] == '%' ) goto l_176;
    if ( data[ 0 ] >= 'A' ) goto l_177;
    if ( data[ 0 ] == ',' ) goto l_178;
    if ( data[ 0 ] == '-' ) goto l_179;
    if ( data[ 0 ] == '+' ) goto l_180;
    if ( data[ 0 ] == '&' ) goto l_181;
    if ( data[ 0 ] == '/' ) goto l_182;
    if ( data[ 0 ] == '(' ) goto l_183;
    if ( data[ 0 ] >= '/' ) goto l_184;
    if ( data[ 0 ] == '*' ) goto l_185;
    if ( data[ 0 ] <= '(' or data[ 0 ] == '.' ) goto l_17;
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    sipe_data->res.clear();
    sipe_data->res += save[ 1 ];
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
  l_20:
    { ast_data.reg( new AstData::Node( AstData::RGT_PAR ), -1 ); }
    goto l_4;
  l_17:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    sipe_data->res.clear();
    sipe_data->res += save[ 1 ];
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_4;
  l_185:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    sipe_data->res.clear();
    sipe_data->res += save[ 1 ];
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
  l_24:
    { ast_data.reg( new AstData::Node( AstData::MUL ), AstData::GRP_MUL ); }
    goto l_4;
  l_184:
    if ( data[ 0 ] <= '9' ) goto l_186;
    if ( data[ 0 ] >= ';' ) goto l_17;
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    sipe_data->res.clear();
    sipe_data->res += save[ 1 ];
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_18;
  l_186:
    { num =            *data - '0'; }
  l_67:
    if ( data >= end_m1 ) goto l_118;
    ++data;
    if ( data[ 0 ] == '=' ) goto l_121;
    if ( data[ 0 ] == '<' ) goto l_119;
    if ( data[ 0 ] == '>' ) goto l_122;
    if ( data[ 0 ] == '!' ) goto l_120;
    if ( data[ 0 ] == '?' ) goto l_124;
    if ( data[ 0 ] == '#' ) goto l_123;
    if ( data[ 0 ] >= 'A' ) goto l_187;
    if ( data[ 0 ] == ',' ) goto l_59;
    if ( data[ 0 ] == '+' ) goto l_58;
    if ( data[ 0 ] == '-' ) goto l_60;
    if ( data[ 0 ] == '*' ) goto l_57;
    if ( data[ 0 ] == '%' ) goto l_53;
    if ( data[ 0 ] == '&' ) goto l_54;
    if ( data[ 0 ] == '/' ) goto l_19;
    if ( data[ 0 ] >= '/' ) goto l_188;
    if ( data[ 0 ] == ')' ) goto l_56;
    if ( data[ 0 ] <= 39 or data[ 0 ] == '.' ) goto l_8;
  l_55:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
  l_23:
    { ast_data.reg( new AstData::Node( AstData::LFT_PAR ), -1 ); }
    goto l_4;
  l_56:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_20;
  l_188:
    if ( data[ 0 ] <= '9' ) goto l_189;
    if ( data[ 0 ] >= ';' ) goto l_8;
    goto l_21;
  l_189:
    { num = 16 * num + *data - '0'; }
  l_66:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    if ( data >= end_m1 ) goto l_22;
    ++data;
    if ( data[ 0 ] == '!' ) goto l_48;
    if ( data[ 0 ] == '<' ) goto l_47;
    if ( data[ 0 ] == '=' ) goto l_63;
    if ( data[ 0 ] == '#' ) goto l_44;
    if ( data[ 0 ] == '>' ) goto l_43;
    if ( data[ 0 ] == '?' ) goto l_38;
    if ( data[ 0 ] == '%' ) goto l_39;
    if ( data[ 0 ] == '&' ) goto l_37;
    if ( data[ 0 ] == '(' ) goto l_23;
    if ( data[ 0 ] == ')' ) goto l_20;
    if ( data[ 0 ] == '*' ) goto l_24;
    if ( data[ 0 ] == '+' ) goto l_34;
    if ( data[ 0 ] == ',' ) goto l_32;
    if ( data[ 0 ] == '-' ) goto l_31;
    if ( data[ 0 ] == '^' ) goto l_33;
    if ( data[ 0 ] == '/' ) goto l_25;
    if ( data[ 0 ] == '0' ) goto l_26;
    if ( data[ 0 ] <= '0' ) goto l_4;
    if ( data[ 0 ] <= '9' ) goto l_14;
    if ( data[ 0 ] == ':' ) goto l_18;
    if ( data[ 0 ] == '|' ) goto l_10;
    if ( data[ 0 ] == '~' ) goto l_7;
    if ( data[ 0 ] == '_' ) goto l_27;
    if ( data[ 0 ] <= '@' ) goto l_4;
    if ( data[ 0 ] <= 'K' ) goto l_27;
    if ( data[ 0 ] >= 'a' ) goto l_28;
    if ( data[ 0 ] == 'L' ) goto l_4;
    if ( data[ 0 ] >= '[' ) goto l_4;
    goto l_27;
  l_33:
    { ast_data.reg( new AstData::Node( AstData::XOR_BIN ), AstData::GRP_XOR_BIN ); }
    goto l_4;
  l_31:
    { ast_data.reg( new AstData::Node( AstData::SUB ), AstData::GRP_SUB ); }
    goto l_4;
  l_32:
    { ast_data.reg( new AstData::Node( AstData::COMMA ), -1 ); }
    goto l_4;
  l_34:
    { ast_data.reg( new AstData::Node( AstData::ADD ), AstData::GRP_ADD ); }
    goto l_4;
  l_37:
    if ( data >= end_m1 ) goto l_190;
    ++data;
    if ( data[ 0 ] == ':' ) goto l_191;
    if ( data[ 0 ] == '!' ) goto l_192;
    if ( data[ 0 ] == '<' ) goto l_193;
    if ( data[ 0 ] == '#' ) goto l_194;
    if ( data[ 0 ] == '=' ) goto l_195;
    if ( data[ 0 ] == '>' ) goto l_196;
    if ( data[ 0 ] == '%' ) goto l_197;
    if ( data[ 0 ] == '?' ) goto l_198;
    if ( data[ 0 ] == '&' ) goto l_199;
    if ( data[ 0 ] == '(' ) goto l_200;
    if ( data[ 0 ] == ')' ) goto l_201;
    if ( data[ 0 ] == '*' ) goto l_202;
    if ( data[ 0 ] == '+' ) goto l_203;
    if ( data[ 0 ] == '^' ) goto l_204;
    if ( data[ 0 ] == ',' ) goto l_205;
    if ( data[ 0 ] == '-' ) goto l_206;
    if ( data[ 0 ] == '/' ) goto l_207;
    if ( data[ 0 ] == '0' ) goto l_208;
    if ( data[ 0 ] <= '0' ) goto l_30;
    if ( data[ 0 ] <= ':' ) goto l_209;
    if ( data[ 0 ] == '|' ) goto l_210;
    if ( data[ 0 ] == '~' ) goto l_211;
    if ( data[ 0 ] <= '@' ) goto l_30;
    if ( data[ 0 ] <= 'Z' ) goto l_29;
    if ( data[ 0 ] <= '`' ) goto l_212;
    if ( data[ 0 ] >= '{' ) goto l_30;
  l_29:
    { ast_data.reg( new AstData::Node( AstData::AND_BIN ), AstData::GRP_AND_BIN ); }
    sipe_data->res.clear();
    goto l_1;
  l_30:
    { ast_data.reg( new AstData::Node( AstData::AND_BIN ), AstData::GRP_AND_BIN ); }
    goto l_4;
  l_212:
    if ( data[ 0 ] <= '`' and data[ 0 ] != '_' ) goto l_30;
    goto l_29;
  l_211:
    { ast_data.reg( new AstData::Node( AstData::AND_BIN ), AstData::GRP_AND_BIN ); }
    goto l_7;
  l_210:
    { ast_data.reg( new AstData::Node( AstData::AND_BIN ), AstData::GRP_AND_BIN ); }
    goto l_10;
  l_209:
    { ast_data.reg( new AstData::Node( AstData::AND_BIN ), AstData::GRP_AND_BIN ); }
    goto l_14;
  l_208:
    { ast_data.reg( new AstData::Node( AstData::AND_BIN ), AstData::GRP_AND_BIN ); }
    goto l_26;
  l_207:
    { ast_data.reg( new AstData::Node( AstData::AND_BIN ), AstData::GRP_AND_BIN ); }
    goto l_25;
  l_206:
    { ast_data.reg( new AstData::Node( AstData::AND_BIN ), AstData::GRP_AND_BIN ); }
    goto l_31;
  l_205:
    { ast_data.reg( new AstData::Node( AstData::AND_BIN ), AstData::GRP_AND_BIN ); }
    goto l_32;
  l_204:
    { ast_data.reg( new AstData::Node( AstData::AND_BIN ), AstData::GRP_AND_BIN ); }
    goto l_33;
  l_203:
    { ast_data.reg( new AstData::Node( AstData::AND_BIN ), AstData::GRP_AND_BIN ); }
    goto l_34;
  l_202:
    { ast_data.reg( new AstData::Node( AstData::AND_BIN ), AstData::GRP_AND_BIN ); }
    goto l_24;
  l_201:
    { ast_data.reg( new AstData::Node( AstData::AND_BIN ), AstData::GRP_AND_BIN ); }
    goto l_20;
  l_200:
    { ast_data.reg( new AstData::Node( AstData::AND_BIN ), AstData::GRP_AND_BIN ); }
    goto l_23;
  l_199:
    { ast_data.reg( new AstData::Node( AstData::AND_LOG ), AstData::GRP_AND_LOG ); }
    goto l_4;
  l_198:
    { ast_data.reg( new AstData::Node( AstData::AND_BIN ), AstData::GRP_AND_BIN ); }
  l_38:
    { ast_data.reg( new AstData::Node( AstData::QUESTION ), AstData::GRP_QUESTION ); }
    goto l_4;
  l_197:
    { ast_data.reg( new AstData::Node( AstData::AND_BIN ), AstData::GRP_AND_BIN ); }
  l_39:
    { ast_data.reg( new AstData::Node( AstData::MOD ), AstData::GRP_MOD ); }
    goto l_4;
  l_196:
    { ast_data.reg( new AstData::Node( AstData::AND_BIN ), AstData::GRP_AND_BIN ); }
  l_43:
    if ( data >= end_m1 ) goto l_213;
    ++data;
    if ( data[ 0 ] == ':' ) goto l_214;
    if ( data[ 0 ] == '!' ) goto l_215;
    if ( data[ 0 ] == '<' ) goto l_216;
    if ( data[ 0 ] == '#' ) goto l_217;
    if ( data[ 0 ] == '=' ) goto l_218;
    if ( data[ 0 ] == '>' ) goto l_219;
    if ( data[ 0 ] == '%' ) goto l_220;
    if ( data[ 0 ] == '?' ) goto l_221;
    if ( data[ 0 ] == '&' ) goto l_222;
    if ( data[ 0 ] == '(' ) goto l_223;
    if ( data[ 0 ] == ')' ) goto l_224;
    if ( data[ 0 ] == '*' ) goto l_225;
    if ( data[ 0 ] == '+' ) goto l_226;
    if ( data[ 0 ] == '^' ) goto l_227;
    if ( data[ 0 ] == ',' ) goto l_228;
    if ( data[ 0 ] == '-' ) goto l_229;
    if ( data[ 0 ] == '/' ) goto l_230;
    if ( data[ 0 ] == '0' ) goto l_231;
    if ( data[ 0 ] <= '0' ) goto l_36;
    if ( data[ 0 ] <= ':' ) goto l_232;
    if ( data[ 0 ] == '|' ) goto l_233;
    if ( data[ 0 ] == '~' ) goto l_234;
    if ( data[ 0 ] <= '@' ) goto l_36;
    if ( data[ 0 ] <= 'Z' ) goto l_35;
    if ( data[ 0 ] <= '`' ) goto l_235;
    if ( data[ 0 ] >= '{' ) goto l_36;
  l_35:
    { ast_data.reg( new AstData::Node( AstData::SUP ), AstData::GRP_SUP ); }
    sipe_data->res.clear();
    goto l_1;
  l_36:
    { ast_data.reg( new AstData::Node( AstData::SUP ), AstData::GRP_SUP ); }
    goto l_4;
  l_235:
    if ( data[ 0 ] <= '`' and data[ 0 ] != '_' ) goto l_36;
    goto l_35;
  l_234:
    { ast_data.reg( new AstData::Node( AstData::SUP ), AstData::GRP_SUP ); }
    goto l_7;
  l_233:
    { ast_data.reg( new AstData::Node( AstData::SUP ), AstData::GRP_SUP ); }
    goto l_10;
  l_232:
    { ast_data.reg( new AstData::Node( AstData::SUP ), AstData::GRP_SUP ); }
    goto l_14;
  l_231:
    { ast_data.reg( new AstData::Node( AstData::SUP ), AstData::GRP_SUP ); }
    goto l_26;
  l_230:
    { ast_data.reg( new AstData::Node( AstData::SUP ), AstData::GRP_SUP ); }
    goto l_25;
  l_229:
    { ast_data.reg( new AstData::Node( AstData::SUP ), AstData::GRP_SUP ); }
    goto l_31;
  l_228:
    { ast_data.reg( new AstData::Node( AstData::SUP ), AstData::GRP_SUP ); }
    goto l_32;
  l_227:
    { ast_data.reg( new AstData::Node( AstData::SUP ), AstData::GRP_SUP ); }
    goto l_33;
  l_226:
    { ast_data.reg( new AstData::Node( AstData::SUP ), AstData::GRP_SUP ); }
    goto l_34;
  l_225:
    { ast_data.reg( new AstData::Node( AstData::SUP ), AstData::GRP_SUP ); }
    goto l_24;
  l_224:
    { ast_data.reg( new AstData::Node( AstData::SUP ), AstData::GRP_SUP ); }
    goto l_20;
  l_223:
    { ast_data.reg( new AstData::Node( AstData::SUP ), AstData::GRP_SUP ); }
    goto l_23;
  l_222:
    { ast_data.reg( new AstData::Node( AstData::SUP ), AstData::GRP_SUP ); }
    goto l_37;
  l_221:
    { ast_data.reg( new AstData::Node( AstData::SUP ), AstData::GRP_SUP ); }
    goto l_38;
  l_220:
    { ast_data.reg( new AstData::Node( AstData::SUP ), AstData::GRP_SUP ); }
    goto l_39;
  l_219:
    { ast_data.reg( new AstData::Node( AstData::SHR ), AstData::GRP_SHR ); }
    goto l_4;
  l_218:
    { ast_data.reg( new AstData::Node( AstData::SUP_EQ ), AstData::GRP_SUP_EQ ); }
    goto l_4;
  l_217:
    { ast_data.reg( new AstData::Node( AstData::SUP ), AstData::GRP_SUP ); }
  l_44:
    if ( data >= end_m1 ) goto l_22;
    ++data;
    if ( data[ 0 ] == ':' ) goto l_18;
    if ( data[ 0 ] == '!' ) goto l_48;
    if ( data[ 0 ] == '<' ) goto l_47;
    if ( data[ 0 ] != '#' ) goto l_40;
    { ast_data.reg( new AstData::Node( AstData::PLACEMAKER ), -1 ); }
    goto l_4;
  l_47:
    if ( data >= end_m1 ) goto l_236;
    ++data;
    if ( data[ 0 ] == ':' ) goto l_237;
    if ( data[ 0 ] == '!' ) goto l_238;
    if ( data[ 0 ] == '<' ) goto l_239;
    if ( data[ 0 ] == '#' ) goto l_240;
    if ( data[ 0 ] == '=' ) goto l_241;
    if ( data[ 0 ] == '>' ) goto l_242;
    if ( data[ 0 ] == '%' ) goto l_243;
    if ( data[ 0 ] == '?' ) goto l_244;
    if ( data[ 0 ] == '&' ) goto l_245;
    if ( data[ 0 ] == '(' ) goto l_246;
    if ( data[ 0 ] == ')' ) goto l_247;
    if ( data[ 0 ] == '*' ) goto l_248;
    if ( data[ 0 ] == '+' ) goto l_249;
    if ( data[ 0 ] == '^' ) goto l_250;
    if ( data[ 0 ] == ',' ) goto l_251;
    if ( data[ 0 ] == '-' ) goto l_252;
    if ( data[ 0 ] == '/' ) goto l_253;
    if ( data[ 0 ] == '0' ) goto l_254;
    if ( data[ 0 ] <= '0' ) goto l_42;
    if ( data[ 0 ] <= ':' ) goto l_255;
    if ( data[ 0 ] == '|' ) goto l_256;
    if ( data[ 0 ] == '~' ) goto l_257;
    if ( data[ 0 ] <= '@' ) goto l_42;
    if ( data[ 0 ] <= 'Z' ) goto l_41;
    if ( data[ 0 ] <= '`' ) goto l_258;
    if ( data[ 0 ] >= '{' ) goto l_42;
  l_41:
    { ast_data.reg( new AstData::Node( AstData::INF ), AstData::GRP_INF ); }
    sipe_data->res.clear();
    goto l_1;
  l_42:
    { ast_data.reg( new AstData::Node( AstData::INF ), AstData::GRP_INF ); }
    goto l_4;
  l_258:
    if ( data[ 0 ] <= '`' and data[ 0 ] != '_' ) goto l_42;
    goto l_41;
  l_257:
    { ast_data.reg( new AstData::Node( AstData::INF ), AstData::GRP_INF ); }
    goto l_7;
  l_256:
    { ast_data.reg( new AstData::Node( AstData::INF ), AstData::GRP_INF ); }
    goto l_10;
  l_255:
    { ast_data.reg( new AstData::Node( AstData::INF ), AstData::GRP_INF ); }
    goto l_14;
  l_254:
    { ast_data.reg( new AstData::Node( AstData::INF ), AstData::GRP_INF ); }
    goto l_26;
  l_253:
    { ast_data.reg( new AstData::Node( AstData::INF ), AstData::GRP_INF ); }
    goto l_25;
  l_252:
    { ast_data.reg( new AstData::Node( AstData::INF ), AstData::GRP_INF ); }
    goto l_31;
  l_251:
    { ast_data.reg( new AstData::Node( AstData::INF ), AstData::GRP_INF ); }
    goto l_32;
  l_250:
    { ast_data.reg( new AstData::Node( AstData::INF ), AstData::GRP_INF ); }
    goto l_33;
  l_249:
    { ast_data.reg( new AstData::Node( AstData::INF ), AstData::GRP_INF ); }
    goto l_34;
  l_248:
    { ast_data.reg( new AstData::Node( AstData::INF ), AstData::GRP_INF ); }
    goto l_24;
  l_247:
    { ast_data.reg( new AstData::Node( AstData::INF ), AstData::GRP_INF ); }
    goto l_20;
  l_246:
    { ast_data.reg( new AstData::Node( AstData::INF ), AstData::GRP_INF ); }
    goto l_23;
  l_245:
    { ast_data.reg( new AstData::Node( AstData::INF ), AstData::GRP_INF ); }
    goto l_37;
  l_244:
    { ast_data.reg( new AstData::Node( AstData::INF ), AstData::GRP_INF ); }
    goto l_38;
  l_243:
    { ast_data.reg( new AstData::Node( AstData::INF ), AstData::GRP_INF ); }
    goto l_39;
  l_242:
    { ast_data.reg( new AstData::Node( AstData::INF ), AstData::GRP_INF ); }
    goto l_43;
  l_241:
    { ast_data.reg( new AstData::Node( AstData::INF_EQ ), AstData::GRP_INF_EQ ); }
    goto l_4;
  l_240:
    { ast_data.reg( new AstData::Node( AstData::INF ), AstData::GRP_INF ); }
    goto l_44;
  l_239:
    { ast_data.reg( new AstData::Node( AstData::SHL ), AstData::GRP_SHL ); }
    goto l_4;
  l_238:
    { ast_data.reg( new AstData::Node( AstData::INF ), AstData::GRP_INF ); }
  l_48:
    if ( data >= end_m1 ) goto l_259;
    ++data;
    if ( data[ 0 ] == ':' ) goto l_260;
    if ( data[ 0 ] == '!' ) goto l_261;
    if ( data[ 0 ] == '<' ) goto l_262;
    if ( data[ 0 ] == '#' ) goto l_263;
    if ( data[ 0 ] == '=' ) goto l_264;
    if ( data[ 0 ] == '>' ) goto l_265;
    if ( data[ 0 ] == '%' ) goto l_266;
    if ( data[ 0 ] == '?' ) goto l_267;
    if ( data[ 0 ] == '&' ) goto l_268;
    if ( data[ 0 ] == '(' ) goto l_269;
    if ( data[ 0 ] == ')' ) goto l_270;
    if ( data[ 0 ] == '*' ) goto l_271;
    if ( data[ 0 ] == '+' ) goto l_272;
    if ( data[ 0 ] == '^' ) goto l_273;
    if ( data[ 0 ] == ',' ) goto l_274;
    if ( data[ 0 ] == '-' ) goto l_275;
    if ( data[ 0 ] == '/' ) goto l_276;
    if ( data[ 0 ] == '0' ) goto l_277;
    if ( data[ 0 ] <= '0' ) goto l_46;
    if ( data[ 0 ] <= ':' ) goto l_278;
    if ( data[ 0 ] == '|' ) goto l_279;
    if ( data[ 0 ] == '~' ) goto l_280;
    if ( data[ 0 ] <= '@' ) goto l_46;
    if ( data[ 0 ] <= 'Z' ) goto l_45;
    if ( data[ 0 ] <= '`' ) goto l_281;
    if ( data[ 0 ] >= '{' ) goto l_46;
  l_45:
    { ast_data.reg( new AstData::Node( AstData::NOT_LOG ), AstData::GRP_NOT_LOG ); }
    sipe_data->res.clear();
    goto l_1;
  l_46:
    { ast_data.reg( new AstData::Node( AstData::NOT_LOG ), AstData::GRP_NOT_LOG ); }
    goto l_4;
  l_281:
    if ( data[ 0 ] <= '`' and data[ 0 ] != '_' ) goto l_46;
    goto l_45;
  l_280:
    { ast_data.reg( new AstData::Node( AstData::NOT_LOG ), AstData::GRP_NOT_LOG ); }
    goto l_7;
  l_279:
    { ast_data.reg( new AstData::Node( AstData::NOT_LOG ), AstData::GRP_NOT_LOG ); }
    goto l_10;
  l_278:
    { ast_data.reg( new AstData::Node( AstData::NOT_LOG ), AstData::GRP_NOT_LOG ); }
    goto l_14;
  l_277:
    { ast_data.reg( new AstData::Node( AstData::NOT_LOG ), AstData::GRP_NOT_LOG ); }
    goto l_26;
  l_276:
    { ast_data.reg( new AstData::Node( AstData::NOT_LOG ), AstData::GRP_NOT_LOG ); }
    goto l_25;
  l_275:
    { ast_data.reg( new AstData::Node( AstData::NOT_LOG ), AstData::GRP_NOT_LOG ); }
    goto l_31;
  l_274:
    { ast_data.reg( new AstData::Node( AstData::NOT_LOG ), AstData::GRP_NOT_LOG ); }
    goto l_32;
  l_273:
    { ast_data.reg( new AstData::Node( AstData::NOT_LOG ), AstData::GRP_NOT_LOG ); }
    goto l_33;
  l_272:
    { ast_data.reg( new AstData::Node( AstData::NOT_LOG ), AstData::GRP_NOT_LOG ); }
    goto l_34;
  l_271:
    { ast_data.reg( new AstData::Node( AstData::NOT_LOG ), AstData::GRP_NOT_LOG ); }
    goto l_24;
  l_270:
    { ast_data.reg( new AstData::Node( AstData::NOT_LOG ), AstData::GRP_NOT_LOG ); }
    goto l_20;
  l_269:
    { ast_data.reg( new AstData::Node( AstData::NOT_LOG ), AstData::GRP_NOT_LOG ); }
    goto l_23;
  l_268:
    { ast_data.reg( new AstData::Node( AstData::NOT_LOG ), AstData::GRP_NOT_LOG ); }
    goto l_37;
  l_267:
    { ast_data.reg( new AstData::Node( AstData::NOT_LOG ), AstData::GRP_NOT_LOG ); }
    goto l_38;
  l_266:
    { ast_data.reg( new AstData::Node( AstData::NOT_LOG ), AstData::GRP_NOT_LOG ); }
    goto l_39;
  l_265:
    { ast_data.reg( new AstData::Node( AstData::NOT_LOG ), AstData::GRP_NOT_LOG ); }
    goto l_43;
  l_264:
    { ast_data.reg( new AstData::Node( AstData::NEQ ), AstData::GRP_NEQ ); }
    goto l_4;
  l_263:
    { ast_data.reg( new AstData::Node( AstData::NOT_LOG ), AstData::GRP_NOT_LOG ); }
    goto l_44;
  l_262:
    { ast_data.reg( new AstData::Node( AstData::NOT_LOG ), AstData::GRP_NOT_LOG ); }
    goto l_47;
  l_261:
    { ast_data.reg( new AstData::Node( AstData::NOT_LOG ), AstData::GRP_NOT_LOG ); }
    goto l_48;
  l_260:
    { ast_data.reg( new AstData::Node( AstData::NOT_LOG ), AstData::GRP_NOT_LOG ); }
    goto l_18;
  l_259:
    { ast_data.reg( new AstData::Node( AstData::NOT_LOG ), AstData::GRP_NOT_LOG ); }
    goto l_22;
  l_237:
    { ast_data.reg( new AstData::Node( AstData::INF ), AstData::GRP_INF ); }
    goto l_18;
  l_236:
    { ast_data.reg( new AstData::Node( AstData::INF ), AstData::GRP_INF ); }
    goto l_22;
  l_216:
    { ast_data.reg( new AstData::Node( AstData::SUP ), AstData::GRP_SUP ); }
    goto l_47;
  l_215:
    { ast_data.reg( new AstData::Node( AstData::SUP ), AstData::GRP_SUP ); }
    goto l_48;
  l_214:
    { ast_data.reg( new AstData::Node( AstData::SUP ), AstData::GRP_SUP ); }
    goto l_18;
  l_213:
    { ast_data.reg( new AstData::Node( AstData::SUP ), AstData::GRP_SUP ); }
    goto l_22;
  l_195:
    { ast_data.reg( new AstData::Node( AstData::AND_BIN ), AstData::GRP_AND_BIN ); }
  l_63:
    if ( data >= end_m1 ) goto l_22;
    ++data;
    if ( data[ 0 ] == ':' ) goto l_18;
    if ( data[ 0 ] == '!' ) goto l_48;
    if ( data[ 0 ] == '<' ) goto l_47;
    if ( data[ 0 ] == '#' ) goto l_44;
    if ( data[ 0 ] != '=' ) goto l_49;
    { ast_data.reg( new AstData::Node( AstData::EQU ), AstData::GRP_EQU ); }
    goto l_4;
  l_194:
    { ast_data.reg( new AstData::Node( AstData::AND_BIN ), AstData::GRP_AND_BIN ); }
    goto l_44;
  l_193:
    { ast_data.reg( new AstData::Node( AstData::AND_BIN ), AstData::GRP_AND_BIN ); }
    goto l_47;
  l_192:
    { ast_data.reg( new AstData::Node( AstData::AND_BIN ), AstData::GRP_AND_BIN ); }
    goto l_48;
  l_191:
    { ast_data.reg( new AstData::Node( AstData::AND_BIN ), AstData::GRP_AND_BIN ); }
    goto l_18;
  l_190:
    { ast_data.reg( new AstData::Node( AstData::AND_BIN ), AstData::GRP_AND_BIN ); }
    goto l_22;
  l_54:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_37;
  l_53:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_39;
  l_57:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_24;
  l_60:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_31;
  l_58:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_34;
  l_59:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_32;
  l_187:
    if ( data[ 0 ] <= '`' ) goto l_282;
  l_61:
    if ( data[ 0 ] <= 'f' ) goto l_283;
    if ( data[ 0 ] == '|' ) goto l_50;
    if ( data[ 0 ] != '~' ) goto l_52;
    goto l_51;
  l_283:
    { num = 16 * num + *data - 'a'; }
    if ( data >= end_m1 ) goto l_118;
    ++data;
    if ( data[ 0 ] == '<' ) goto l_119;
    if ( data[ 0 ] == '!' ) goto l_120;
    if ( data[ 0 ] == '=' ) goto l_121;
    if ( data[ 0 ] == '>' ) goto l_122;
    if ( data[ 0 ] == '#' ) goto l_123;
    if ( data[ 0 ] == '?' ) goto l_124;
    if ( data[ 0 ] == '%' ) goto l_53;
    if ( data[ 0 ] == '&' ) goto l_54;
    if ( data[ 0 ] == '(' ) goto l_55;
    if ( data[ 0 ] == ')' ) goto l_56;
    if ( data[ 0 ] == '*' ) goto l_57;
    if ( data[ 0 ] == '+' ) goto l_58;
    if ( data[ 0 ] == ',' ) goto l_59;
    if ( data[ 0 ] == '-' ) goto l_60;
    if ( data[ 0 ] == '^' ) goto l_64;
    if ( data[ 0 ] == '/' ) goto l_19;
    if ( data[ 0 ] == '0' ) goto l_284;
    if ( data[ 0 ] <= '0' ) goto l_8;
    if ( data[ 0 ] <= '9' ) goto l_285;
    if ( data[ 0 ] >= 'a' ) goto l_61;
    if ( data[ 0 ] == ':' ) goto l_21;
    if ( data[ 0 ] <= '@' ) goto l_8;
  l_65:
    if ( data[ 0 ] <= 'K' ) goto l_9;
    if ( data[ 0 ] == '_' ) goto l_9;
    goto l_62;
  l_285:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_14;
  l_284:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_26;
  l_64:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_33;
  l_124:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_38;
  l_123:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_44;
  l_122:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_43;
  l_121:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_63;
  l_120:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_48;
  l_119:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_47;
  l_118:
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_22;
  l_282:
    if ( data[ 0 ] <= 'F' ) goto l_286;
    if ( data[ 0 ] != '^' ) goto l_65;
    goto l_64;
  l_286:
    { num = 16 * num + *data - 'A'; }
    goto l_66;
  l_183:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    sipe_data->res.clear();
    sipe_data->res += save[ 1 ];
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_23;
  l_182:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    sipe_data->res.clear();
    sipe_data->res += save[ 1 ];
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_25;
  l_181:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    sipe_data->res.clear();
    sipe_data->res += save[ 1 ];
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_37;
  l_180:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    sipe_data->res.clear();
    sipe_data->res += save[ 1 ];
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_34;
  l_179:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    sipe_data->res.clear();
    sipe_data->res += save[ 1 ];
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_31;
  l_178:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    sipe_data->res.clear();
    sipe_data->res += save[ 1 ];
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_32;
  l_177:
    if ( data[ 0 ] <= 'F' ) goto l_287;
    if ( data[ 0 ] == '^' ) goto l_288;
    if ( data[ 0 ] <= '`' ) goto l_289;
    if ( data[ 0 ] <= 'f' ) goto l_290;
    if ( data[ 0 ] == '|' ) goto l_291;
    if ( data[ 0 ] != '~' ) goto l_292;
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    sipe_data->res.clear();
    sipe_data->res += save[ 1 ];
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_7;
  l_292:
    if ( data[ 0 ] >= '{' ) goto l_17;
  l_68:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    sipe_data->res.clear();
    sipe_data->res += save[ 1 ];
    goto l_1;
  l_291:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    sipe_data->res.clear();
    sipe_data->res += save[ 1 ];
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_10;
  l_290:
    { num =            *data - 'a'; }
    goto l_67;
  l_289:
    if ( data[ 0 ] == '_' ) goto l_68;
    if ( data[ 0 ] >= '[' ) goto l_17;
    goto l_68;
  l_288:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    sipe_data->res.clear();
    sipe_data->res += save[ 1 ];
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_33;
  l_287:
    { num =            *data - 'A'; }
    goto l_67;
  l_176:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    sipe_data->res.clear();
    sipe_data->res += save[ 1 ];
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_39;
  l_175:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    sipe_data->res.clear();
    sipe_data->res += save[ 1 ];
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_38;
  l_174:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    sipe_data->res.clear();
    sipe_data->res += save[ 1 ];
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_44;
  l_173:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    sipe_data->res.clear();
    sipe_data->res += save[ 1 ];
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_43;
  l_172:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    sipe_data->res.clear();
    sipe_data->res += save[ 1 ];
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_63;
  l_171:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    sipe_data->res.clear();
    sipe_data->res += save[ 1 ];
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_48;
  l_170:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    sipe_data->res.clear();
    sipe_data->res += save[ 1 ];
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_47;
  l_169:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    sipe_data->res.clear();
    sipe_data->res += save[ 1 ];
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_22;
  l_164:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_18;
  l_163:
    { num =            *( save + 0 ) - '0'; }
    goto l_69;
  l_162:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_25;
  l_161:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_31;
  l_160:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_32;
  l_159:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_33;
  l_158:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_34;
  l_157:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_24;
  l_156:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_20;
  l_155:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_23;
  l_154:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_37;
  l_153:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_39;
  l_152:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_44;
  l_151:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_38;
  l_150:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_48;
  l_149:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_43;
  l_148:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_47;
  l_147:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_63;
  l_146:
    { num =            *( save + 0 ) - '0'; }
    { ast_data.reg( new AstData::Node( AstData::NUMBER, num ), -1 ); }
    goto l_22;
  l_70:
    if ( data >= end_m1 ) goto l_22;
    ++data;
    if ( data[ 0 ] == 10 ) goto l_4;
    goto l_70;
  l_140:
    { ast_data.reg( new AstData::Node( AstData::DIV ), AstData::GRP_DIV ); }
    goto l_31;
  l_139:
    { ast_data.reg( new AstData::Node( AstData::DIV ), AstData::GRP_DIV ); }
    goto l_32;
  l_138:
    { ast_data.reg( new AstData::Node( AstData::DIV ), AstData::GRP_DIV ); }
    goto l_33;
  l_137:
    { ast_data.reg( new AstData::Node( AstData::DIV ), AstData::GRP_DIV ); }
    goto l_34;
  l_71:
    if ( data >= end_m1 ) goto l_22;
    ++data;
  l_72:
    if ( data[ 0 ] != '*' ) goto l_71;
    if ( data >= end_m1 ) goto l_22;
    ++data;
    if ( data[ 0 ] == '/' ) goto l_4;
    goto l_72;
  l_136:
    { ast_data.reg( new AstData::Node( AstData::DIV ), AstData::GRP_DIV ); }
    goto l_20;
  l_135:
    { ast_data.reg( new AstData::Node( AstData::DIV ), AstData::GRP_DIV ); }
    goto l_23;
  l_134:
    { ast_data.reg( new AstData::Node( AstData::DIV ), AstData::GRP_DIV ); }
    goto l_37;
  l_133:
    { ast_data.reg( new AstData::Node( AstData::DIV ), AstData::GRP_DIV ); }
    goto l_38;
  l_132:
    { ast_data.reg( new AstData::Node( AstData::DIV ), AstData::GRP_DIV ); }
    goto l_39;
  l_131:
    { ast_data.reg( new AstData::Node( AstData::DIV ), AstData::GRP_DIV ); }
    goto l_43;
  l_130:
    { ast_data.reg( new AstData::Node( AstData::DIV ), AstData::GRP_DIV ); }
    goto l_63;
  l_129:
    { ast_data.reg( new AstData::Node( AstData::DIV ), AstData::GRP_DIV ); }
    goto l_44;
  l_128:
    { ast_data.reg( new AstData::Node( AstData::DIV ), AstData::GRP_DIV ); }
    goto l_47;
  l_127:
    { ast_data.reg( new AstData::Node( AstData::DIV ), AstData::GRP_DIV ); }
    goto l_48;
  l_126:
    { ast_data.reg( new AstData::Node( AstData::DIV ), AstData::GRP_DIV ); }
    goto l_18;
  l_125:
    { ast_data.reg( new AstData::Node( AstData::DIV ), AstData::GRP_DIV ); }
    goto l_22;
  l_113:
    { ast_data.reg( new AstData::Node( AstData::OR_BIN ), AstData::GRP_OR_BIN ); }
    goto l_26;
  l_112:
    { ast_data.reg( new AstData::Node( AstData::OR_BIN ), AstData::GRP_OR_BIN ); }
    goto l_25;
  l_111:
    { ast_data.reg( new AstData::Node( AstData::OR_BIN ), AstData::GRP_OR_BIN ); }
    goto l_31;
  l_110:
    { ast_data.reg( new AstData::Node( AstData::OR_BIN ), AstData::GRP_OR_BIN ); }
    goto l_32;
  l_109:
    { ast_data.reg( new AstData::Node( AstData::OR_BIN ), AstData::GRP_OR_BIN ); }
    goto l_33;
  l_108:
    { ast_data.reg( new AstData::Node( AstData::OR_BIN ), AstData::GRP_OR_BIN ); }
    goto l_34;
  l_107:
    { ast_data.reg( new AstData::Node( AstData::OR_BIN ), AstData::GRP_OR_BIN ); }
    goto l_24;
  l_106:
    { ast_data.reg( new AstData::Node( AstData::OR_BIN ), AstData::GRP_OR_BIN ); }
    goto l_20;
  l_105:
    { ast_data.reg( new AstData::Node( AstData::OR_BIN ), AstData::GRP_OR_BIN ); }
    goto l_23;
  l_104:
    { ast_data.reg( new AstData::Node( AstData::OR_BIN ), AstData::GRP_OR_BIN ); }
    goto l_37;
  l_103:
    { ast_data.reg( new AstData::Node( AstData::OR_BIN ), AstData::GRP_OR_BIN ); }
    goto l_38;
  l_102:
    { ast_data.reg( new AstData::Node( AstData::OR_BIN ), AstData::GRP_OR_BIN ); }
    goto l_39;
  l_101:
    { ast_data.reg( new AstData::Node( AstData::OR_BIN ), AstData::GRP_OR_BIN ); }
    goto l_43;
  l_100:
    { ast_data.reg( new AstData::Node( AstData::OR_BIN ), AstData::GRP_OR_BIN ); }
    goto l_63;
  l_99:
    { ast_data.reg( new AstData::Node( AstData::OR_BIN ), AstData::GRP_OR_BIN ); }
    goto l_44;
  l_98:
    { ast_data.reg( new AstData::Node( AstData::OR_BIN ), AstData::GRP_OR_BIN ); }
    goto l_47;
  l_97:
    { ast_data.reg( new AstData::Node( AstData::OR_BIN ), AstData::GRP_OR_BIN ); }
    goto l_48;
  l_96:
    { ast_data.reg( new AstData::Node( AstData::OR_BIN ), AstData::GRP_OR_BIN ); }
    goto l_18;
  l_95:
    { ast_data.reg( new AstData::Node( AstData::OR_BIN ), AstData::GRP_OR_BIN ); }
    goto l_22;
  l_91:
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_18;
  l_90:
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_25;
  l_89:
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_31;
  l_88:
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_32;
  l_87:
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_33;
  l_86:
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_34;
  l_85:
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_24;
  l_84:
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_20;
  l_83:
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_23;
  l_82:
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_37;
  l_81:
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_38;
  l_80:
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_39;
  l_79:
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_43;
  l_78:
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_63;
  l_77:
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_44;
  l_76:
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_47;
  l_75:
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_48;
  l_74:
    { ast_data.reg( new AstData::Node( AstData::VARIABLE, 0, std::move( sipe_data->res ) ), -1 ); }
    goto l_22;
  l_73:
    if ( data[ 0 ] <= '`' and data[ 0 ] != '_' ) goto l_4;
    goto l_27;
}
