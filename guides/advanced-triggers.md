## Advanced Trigger Mechanics

<!---
<ol></ol>
<li><a href=""></a></li>
--->

<ol>
  <li><a href="#conditions">Conditions</a>
    <ol>
      <li><a href="#variable-conditions">Variable Conditions</a></li>
      <li><a href="#character-classes">Character Classes</a></li>
    </ol>
  </li>
  <li><a href="#capture-phrases">Capture Phrases</a>
    <ol>
      <li><a href="#capture-method">Capture Method</a></li>
      <li><a href="#capture-cooldown">Cooldown</a></li>
      <li><a href="#capture-phrases-grid">Capture Phrases Grid</a></li>
    </ol>
  </li>
  <li><a href="#advanced-ramblings">Advanced Ramblings</a>
    <ol>
      <li><a href="#capture-and-render-snippets">Snippets</a></li>
      <li><a href="#variable-storage-mechanics">Variable storage mechanics</a></li>
    </ol>
  </li>
</ol>

Nag triggers consist of 3 basic things: Conditions, Capture Phrases, and Actions.




## Conditions

![image](https://user-images.githubusercontent.com/66176124/136702770-425e61bc-10c7-4e50-a903-304a9dfcd907.png)


Conditions are automatic checks that enable or disable a trigger.  These checks are typicall light-weight and performant.  They come in two varieties as of this time: Variable checks and Class checks.

#### Variable Conditions

On the Capture tab, in the Conditions group, a trigger can have multiple variable checks which, if failed, disable the execution of Capture Phrases. There are two built-in variable types (SpellBeingCast and CurrentZone), but more can be added (refer to the Variable trigger actions below).  A variable condition allows four operators: 

  Operator&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| Details
  :------------     | :-------------
  Is empty          | Returns true when the specified variable has no value.
  Equals            | Returns true when the specified variable exactly equals the given value(s).
  Is not equal to   | Returns true when the specified variable is not exactly equal to the given value(s).
  Contains          | Returns true when the specified variable matches a given value(s).
  
##### _A note on condition values_

If the condition should pass for multiple values, for example if a Raid Ability is cast by mobs that are in Ssraeshza Temple, Wakening Land, Wall of Slaughter, Plane of Time B, and Timorous Deep, then the value for that check should be as shown below.  Note that Plane of Time B is just "Plane of Time".  The trigger that keeps track of the player's zone uses the log entry: You have entered ZoneName.  This zone name isn't always 100% predictable.

```
Ssraeshza Temple|Wakening Land|Wall of Slaughter|Plane of Time|Timorous Deep
```

#### Character Classes

In the Characters tab, you can specify which class the trigger should be activated for, and at what level.




## Capture Phrases

![image](https://user-images.githubusercontent.com/66176124/136701658-a83a9400-c25f-4781-8ac5-f8e30d046c93.png)

Capture phrases can be either simple text or regular expressions.  These are the phrases that are watched for in the log file.

There are several options when setting up capture phrase(s): capture method, cooldown, and the capture phrases.

#### Capture Method

  Capture Method&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| Details
  :------------     | :-------------
  Any Match         | Actions can be triggered from any capture phrase, at any time.  Each capture phrase is parsed on every log entry when this trigger is active.
  Sequential        | Capture phrases must be matched in order, meaning that any actions attached to the no. 2 phrase cannot be executed until the first phrase has been found.
  Concurrent        | Not implemented yet. All capture phrases must match before actions are executed.

#### Capture Cooldown

Once a capture phrase has been parsed/executed, a cooldown begins that will prevent any further capture phrases from being checked for the specified duration.

#### Capture Phrases Grid

To add a new capture phrase to a trigger, click on the green **\[+ New\]** button on the group header.

The grid columns show, from left to right, the control to change a phrase's position in the grid, the position number, the capture phrase text, a checkbox to enable regular expresions, and the delete button.




<!--- #### Variable Trigger Actions --->




## Advanced Ramblings

### Capture and Render snippets

These snippets can be used to easily accomplish commonly repeated tasks in either capture phrases, in timer labels, or in alert texts.

##### Capture Phrase snippets

  Snippet&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| Description | Alt
  :------------     | :------------- | :-------------
  {TS}              | Matches any duration, and uses that value as the duration for any timers/countdowns that are triggered from the capture phrase. | 
  {C}               | Matches your current character's name exactly. | ${Character}
  {S\[0-9\]}        | Matches any string, and can be used in alert messages or timer labels. | 
  {N\[0-9\]}        | Matches any number, and can be used in alert messages or timer labels. | 
  

##### Literal snippets

  Snippet&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| Description | Alt
  :------------     | :------------- | :-------------
  {TS}              | Matches any number or duration, and uses that value as the duration for any timers/countdowns that are triggered from the capture phrase. | 
  {C}               | Matches your current character's name exactly. | ${Character}
  +{_CounterName_}  | Prints the current value of _CounterName_. | 
  {S\[0-9\]}        | When matched with a capture phrase, renders the matched value in text and labels. | 
  {N\[0-9\]}        | When matched with a capture phrase, renders the matched value in text and labels. | 
  {L}               | Renders the matched log entry in text and labels. | 

#### Variable storage mechanics

  Because latency is a thing, behind the scenes each variable can contain multiple values that are stored in an array.  When a check is performed, the operators work as detailed here:

  Operator&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| Details
  :------------     | :-------------
  Is empty          | Checks if the array length is greater than 0 and returns false if that condition is true.
  Equals            | Checks if the array contains an element that matches exactly one of the given value(s).
  Is not equal to   | Checks if the array contains the exact value(s), and if found returns false.
  Contains          | Checks if the array contains an element that matches the given value. The match is not case-sensitive.
