## Advanced Trigger Mechanics

Nag triggers consist of 3 basic things: Conditions, Capture Phrases, and Actions.

[snippets](#snippets)

### Conditions

Conditions are automatic checks that enable or disable a trigger.  These checks are typicall light-weight and performant.  They come in two varieties as of this time: Variable checks and Class checks.

#### Variable Conditions

On the Capture tab, in the Conditions group, a trigger can have multiple variable checks which, if failed, disable the execution of Capture Phrases. There are two built-in variable types (SpellBeingCast and CurrentZone), but more can be added (refer to the Variable trigger actions below).  A variable condition allows four operators: 

  Operator          | Details
  :------------     | :-------------
  Is empty          | Returns true when the specified variable has no value.
  Equals            | Returns true when the specified variable exactly equals the given value(s).
  Is not equal to   | Returns true when the specified variable is not exactly equal to the given value(s).
  Contains          | Returns true when the specified variable matches a given value(s).
  
##### _A note on condition values_

If the condition should pass for multiple values, for example if a Raid Ability is cast by mobs that are in Ssraeshza Temple, Wakening Land, Wall of Slaughter, Plane of Time B, and Timorous Deep, then the value for that check should be 

```
Ssraeshza Temple|Wakening Land|Wall of Slaughter|Plane of Time B|Timorous Deep
```

#### Character Classes

In the Characters tab, you can specify which class the trigger should be activated for, and at what level.

#### Variable Trigger Actions

<a name="snippets"></a>
## Capture and Render snippets

## Advanced Topics

#### Variable storage mechanics
  
  Because latency is a thing, behind the scenes each variable can contain multiple values that are stored in an array.  When a check is performed, the operators work as detailed here:

  Operator          | Details
  :------------     | :-------------
  Is empty          | Checks if the array length is greater than 0 and returns false if that condition is true.
  Equals            | Checks if the array contains an element that matches exactly one of the given value(s).
  Is not equal to   | Checks if the array contains the exact value(s), and if found returns false.
  Contains          | Checks if the array contains an element that matches the given value. The match is not case-sensitive.
