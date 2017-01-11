# What is Nsmake ?

Nsmake stands for "No Script Make". It is a *fast* and *extensible* build system, designed to dramatically *reduce redundancies, trivial and tangled information*, while  guaranteeing *correctness*, even for complex code generation schemes.

Nsmake takes responsibility to *ensure the link between the tools*. In most of the cases, it enables complete removal of the need for boilerplates and configuration files, and suppression of most sources of discrepancies.

<!-- TOC -->

- [What is Nsmake ?](#what-is-nsmake-)
- [Main features](#main-features)
    - [Orthogonal, clean and clear configuration](#orthogonal-clean-and-clear-configuration)
    - [Speed, incrementality and correctness](#speed-incrementality-and-correctness)
    - [Modules, libraries and external tools](#modules-libraries-and-external-tools)
    - [Specific features](#specific-features)
        - [Javascript and friends](#javascript-and-friends)
        - [For native executables (C++/...)](#for-native-executables-c)
- [Some tutorials](#some-tutorials)
- [More specific information](#more-specific-information)

# Table of contents

<!-- /TOC -->

# Main features

## Orthogonal, clean and clear configuration

* Extensive analysis of trees and content for all the source languages. **Nsmake will never ask you to specify information that can be found directly or indirectly from the sources**.
* No global intricate configuration(s) file(s). **Information is specified where it is relevant** and use of global variables are a choice of the user, not of the build system.
* No Domain Specific Language: most of the source languages already have conditionals, pre-processors, ... Nsmake let's you be consistent with the programming languages you're already using, **avoiding the need to cope with new conventions and new tools**.
* Overall Significant **reduction of number of configuration files**, and need for boilerplates: Nsmake takes the responsibility to fill the gap, allowing cleansing, and cooperation for tools (compilation, testing, etc...) that need the same kinds of information.
* Respect of the source tree: Nsmake tries as much as possible to **generate files in separate build directories, with proper and secure naming**, leaving you in full control of your directories.

## Speed, incrementality and correctness

* The task runner works as a **server**, dramatically reducing start-up time, and enabling consistency for parallel builds.
* Tasks run in micro-services that can interact with the task runner to dynamically instantiate **sub-tasks in parallel**, enabling additional level of parallelism.
* Deep in-memory and database caching: all the results of the idempotent tasks are **condensed and cached** (from the parsing results to the dependency analysis).
* Deep dependency analysis for dramatically **improved correctness**: Test on files that does *not* exist, on configuration information, on external tool evolutions, ...
* **Watch mode** for all the kinds of targets.

## Modules, libraries and external tools

* **Automatic checking and installation of all the kinds of dependencies and prerequisites**: automatic finding, testing and installation of missing modules, libraries, tools... Use of a collaborative content for rules defined by system, by rights, etc...
* **Handling of flags and specifications** (e.g. to use a CDN instead of a local copy, for the specification of the include paths, the library flags, ...) extensive code analysis, enabling dramatic simplification of configuration for libraries.

## Specific features

### Javascript and friends

* Concatenation, Minification, Typescript, Coffeescript, React extensions, ... with of course plugins and support for arbitrary transformations (e.g. with babel plugins and presets, etc...).
* Full support for **Hot Module Reload** (as e.g. in WebPack).
* Rules for **Nodejs *and* Web** targets (where policies for concatenation, CDN, etc... are not the same),
* **Generation of the surrounding of `.js`-like entry points**: from the complete needed `.html` files (handling of script inclusion, templates, ...), to the sourcemaps.
* Integrated support for **testing frameworks** (mocha, karma, ...),
* **Integrated preprocessing** support (e.g. for handling of target execution, language environment, ...)

### For native executables (C++/...)

* Fully compliant C/C++ preprocessor (proper variable substitution, extensions like `#include_next`, `##__VA_ARGS__`, etc...)
* Rules for **inline preprocessing** code generation (launching of nsmake tasks for code inclusion and modification during code parsing).
* Automatic handling of **flags and downloads** for external libraries (`#include <libxml/tree.h>` probably that `libxml` is needed).
* Integrated support for **testing frameworks** (gtest, ...),

# Some tutorials

* [Packing/minification of a generic web application](https://github.com/hleclerc/nsmake/wiki/Tutorial:-compilation-of-a-generic-web-application)
* [Compilation/link of a C++ application](https://github.com/hleclerc/nsmake/wiki/Tutorial:-compilation-of-a-C---executable)

# More specific information

* [Testing a web/nodejs application using Mocha, Chai and Karma](https://github.com/hleclerc/nsmake/wiki/Testing-your-code-with-Mocha,-Karma,-Chai...)
* [Testing a C++ application using gtest](https://github.com/hleclerc/nsmake/wiki/Tutorial:-compilation-of-a-CPP-executable)

