---
name: testing
description: >
  Applies repository testing standards while creating, changing, reviewing,
  debugging, or diagnosing tests and test-related code. Use whenever working
  on a test, test file, fixture, mock, stub, fake, test helper, or production
  change that requires test coverage.
---

# Testing Guidelines

---

## Load relevant testing guidelines

For every relevant production or test file, find and read every `TESTING.md`
file in its directory hierarchy, starting at the repository root and ending in
the file's directory. Incorporate all of their instructions before working on
the test. When instructions conflict, the `TESTING.md` closest to the relevant
file takes precedence.

Repeat this lookup when work expands into another directory hierarchy.

## When to write tests

Write tests at the same time as the function, not after. Tests written after the fact test the code you wrote, not the behaviour you intended.

Write a test before you write a function when the expected inputs, outputs, and failure modes are clear. If they are not clear, clarify them before writing either the function or the test.

## What to test

For each function, write tests that cover: the normal case with representative valid inputs, each edge case you identified when defining the function (empty collections, zero values, boundary values, null or missing optional inputs), and each failure mode — inputs that are invalid, states that are illegal, dependencies that are unavailable.

Do not test implementation details. Test observable behaviour: what the function returns given specific inputs, what side effects it produces, what errors it raises. If a test breaks because you renamed a private variable, the test is testing the wrong thing.

## How to structure a test

Each test must cover exactly one behaviour. If a test fails, the name of the test must be sufficient to identify what behaviour is broken without reading the test body.

Name every test as a plain-language statement of the behaviour it verifies. `test_returns_empty_list_when_input_is_empty` is a valid name. `test_foo` is not.

A test must not depend on the execution order of other tests. Each test must set up everything it needs and clean up everything it creates.

Do not share mutable state between tests. A test that passes in isolation but fails when run alongside other tests reveals a dependency that must be eliminated.

## What counts as a unit

Not every function requires its own test. A private helper that is small, simple, and fully exercised by the tests of its caller does not need separate tests. A function that is complex, used in multiple places, or encapsulates a non-trivial algorithm must have its own tests.

Some tests should cover several functions together, particularly when the interaction between functions is itself a source of risk. Integration-level tests are not a substitute for testing complex individual functions, but they are appropriate for verifying that correctly-functioning pieces combine correctly.

## Test doubles

Use a test double (stub, fake, or mock) when a real dependency is slow, non-deterministic, has side effects that are unacceptable in a test (writing to a database, sending an email), or is not available in the test environment.

Do not use a mock when the real dependency is fast, deterministic, and has no unacceptable side effects. Mocking things that do not need to be mocked adds complexity and makes tests fragile.

When you use a mock, verify that it is configured to behave the way the real dependency would behave in the scenario you are testing. A mock that returns values the real dependency would never return is not testing your code.

## Maintaining tests

When a test fails, read the failure before changing anything. Determine whether the failure indicates a bug in the code or a mistake in the test. Do not change the test until you know which it is.

If a test was correct and the code change that broke it is also correct, rewrite the test to reflect the new intended behaviour and document in the commit message what changed and why the test needed to change.

Do not delete a test because it is inconvenient. Do not mark a test as skipped without adding a comment that states the exact condition under which the skip must be removed, in terms that have a definite answer (a ticket number, a version number, a specific observable condition — not "when we have time").

## Test setup and fixtures

Any setup that more than a small number of tests need must be extracted into a fixture, helper function, or helper class. Do not copy setup code between tests.

## Arrange, act, assert

Structure every test in three steps: arrange the preconditions, perform the action under test, assert on the result. Simple tests may omit arrange or collapse act and assert into a single statement of two or three lines. If any of the three steps starts to grow, extract everything that is not directly relevant to the specific behaviour under test into a named fixture or helper.

## Tests must be self-contained

A test must contain everything a reader needs to understand what it is testing. If a test creates data through a helper and then asserts on that data, every field the test asserts on must either be explicitly passed into the helper by the test, or returned by the helper and stored in a variable that the test then uses in the assertion. Never assert on a literal value that was defined inside a helper and is not visible in the test body. A reader must be able to see, from the test alone, what values are expected and where they came from.

## Type safety takes precedence over tests

Do not write a test to verify a property that the type system already enforces. If a function cannot receive an argument of the wrong type because the type checker will reject it at the call site, a test for that case adds no value and creates noise. Tests are for behaviour the type system cannot express.
