# What is Nsmake ?

Nsmake stands for "No Script Make". It is a *fast* and *extensible* build system, designed to dramatically *reduce redundancies, trivial and tangled information* in build configurations, while guaranteeing *correctness*, even for complex code generation schemes.

Nsmake takes responsibility to *ensure the link between the tools*. In most cases, it allows to get rid of the usual large number of configuration files (and thus boilerplates...), and most sources of discrepancies in build configurations.

Speed comes from the use of a server, with micro-services (that can be written in any language).

# Table of contents:

<!-- TOC -->

- [What is Nsmake ?](#what-is-nsmake-)
- [Table of contents:](#table-of-contents)
- [Main features](#main-features)
    - [Orthogonal, clean and clear configuration](#orthogonal-clean-and-clear-configuration)
    - [Speed, incrementality and correctness](#speed-incrementality-and-correctness)
    - [Modules, libraries and external tools](#modules-libraries-and-external-tools)
- [Specific features](#specific-features)
    - [Javascript and friends](#javascript-and-friends)
    - [For native executables (C++/...)](#for-native-executables-c)
- [Installation](#installation)
- [Some tutorials](#some-tutorials)
- [FAQ](#faq)
- [More specific information](#more-specific-information)

<!-- /TOC -->

# Main features

## Orthogonal, clean and clear configuration

* Extensive analysis of trees and content for all the source languages. **Nsmake will never ask you to specify information that can be found or easily infered from the sources**.
* No global intricate configuration(s) file(s). **Information is specified where it is relevant** and use of global variables are a choice of the user, not of the build system.
* No Domain Specific Language: most of the source languages already have conditionals, pre-processors, ... Nsmake let's you be **consistent with the programming languages you're already using**, avoiding the need to cope with new conventions new tools, a new DSL, and so on.
* Overall significant **reduction of number of configuration files**, and need for boilerplates: Nsmake takes the responsibility to fill the gap, allowing cleansing, and cooperation for tools (compilation, testing, etc...) that need the same kinds of information.
* Respect of the source tree: Nsmake tries as much as possible to **generate files in separate build directories, with proper and secure naming**, leaving you in full control of your directories.

## Speed, incrementality and correctness

* The task runner works as a **server**, dramatically reducing start-up time, and enabling consistency for parallel builds.
* Tasks run in micro-services that can interact with the task runner to dynamically instantiate **sub-tasks in parallel**, enabling additional level of parallelism.
* Deep in-memory and database caching: all the results of the idempotent tasks are **condensed and cached** (from the parsing results to the dependency analysis...).
* Deep dependency analysis for dramatically **improved correctness**: tests on files that does *not* exist, tests on external tool evolutions, etc...
* **Watch mode** for all the kinds of targets.

## Modules, libraries and external tools

* **Automatic checking and installation of all the kinds of dependencies and prerequisites**: automatic finding, testing and installation of missing modules, libraries, tools... Use of a collaborative content for rules defined by system, by rights, etc...
* **Handling of flags and specifications** (e.g. to use a CDN instead of a local copy, for the specification of the include paths, the library flags, ...), using extensive code analysis to enable dramatic simplification of configuration for libraries.

# Specific features

## Javascript and friends

* Concatenation, Minification, Typescript, Coffeescript, React extensions, Sass, etc... with of course plugins and support for arbitrary transformations (e.g. with babel plugins and presets, etc...).
* Full support for **Hot Module Reload** (as e.g. in WebPack).
* Rules for **Nodejs *and* Web** targets (where policies for concatenation, CDN, and so on... may not be the same),
* **Generation of the surrounding of `.js`-like entry points**: from the complete needed `.html` files (handling of script inclusion, templates, ...), to the sourcemaps.
* Integrated support for **testing frameworks** (mocha, karma, ...),
* **Integrated preprocessing** support (e.g. for handling of target execution, language environment, ...)

## For native executables (C++/...)

* Fully compliant C/C++ preprocessor (proper variable substitution, extensions like `#include_next`, `##__VA_ARGS__`, etc...)
* Rules for **inline preprocessing** code generation (launching of nsmake tasks for code inclusion and modification during code parsing).
* Automatic handling of **flags and downloads** for external libraries using community based rules (that can be surdefined) and information in sources (inclusions, ...).
* Integrated support for **testing frameworks** (gtest, ...),

# Installation

```
git clone https://github.com/hleclerc/nsmake.git
cd nsmake
npm install
npm run build
```

After that, npm can make global links for you (a sudo may be necessary)
```
npm link
```

Alternatively, adding the nsmake source dir in the PATH will also work (without needing to be a sudoer).

# Some tutorials

* [Compilation of a C++ application](https://github.com/hleclerc/nsmake/wiki/Tutorial:-compilation-of-a-CPP-executable)
* [Packing/minification of a generic web application](https://github.com/hleclerc/nsmake/wiki/Tutorial:-compilation-of-a-generic-web-application)
* [Plugins](https://github.com/hleclerc/nsmake/wiki/Plugins)

# FAQ

Here is a [list of potentially frequently asked questions](https://github.com/hleclerc/nsmake/wiki/Potentially-Frequently-Asked-Questions).

# More specific information

* [Filters for code generation](https://github.com/hleclerc/nsmake/wiki/Flags-and-automatic-installation-of-libraries-for-compiler-languages.md)
* [Testing a web/nodejs application using Mocha, Chai and Karma](https://github.com/hleclerc/nsmake/wiki/Testing-your-code-with-Mocha,-Karma,-Chai...)
* [Testing a C++ application using gtest](https://github.com/hleclerc/nsmake/wiki/Testing-your-C---code-with-gtest-(google-test))
* [Description of libraries and prerequisites for your projects](https://github.com/hleclerc/nsmake/wiki/Flags-and-automatic-installation-of-libraries-for-compiler-languages)
* [Wiki home](https://github.com/hleclerc/nsmake/wiki/Home)
