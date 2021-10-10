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
  <li><a href="#actions">Actions</a>
    <ol>
      <li><a href="#action-types">Action Types</a>
        <ol>
          <li><a href="#display-text-action">Display Text</a></li>
          <li><a href="#dot-timer-action">DoT Timer</a></li>
        </ol>
      </li>
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

![image](https://user-images.githubusercontent.com/66176124/136704296-06844534-6434-4c39-853d-acea92a2ebb3.png)


In the Characters tab, you can specify which class the trigger should be activated for, and at what level.




## Capture Phrases

![image](https://user-images.githubusercontent.com/66176124/136701658-a83a9400-c25f-4781-8ac5-f8e30d046c93.png)

Capture phrases can be either simple text or regular expressions.  These are the phrases that are watched for in the log file.

There are several options when setting up capture phrase(s): capture method, cooldown, and the capture phrases.

#### Capture Method

  Capture Method &nbsp;&nbsp;&nbsp;&nbsp;| Details
  :------------     | :-------------
  Any Match         | Actions can be triggered from any capture phrase, at any time.  Each capture phrase is parsed on every log entry when this trigger is active.
  Sequential        | Capture phrases must be matched in order, meaning that any actions attached to the no. 2 phrase cannot be executed until the first phrase has been found.
  Concurrent        | Not implemented yet. All capture phrases must match before actions are executed.

#### Capture Cooldown

Once a capture phrase has been parsed/executed, a cooldown begins that will prevent any further capture phrases from being checked for the specified duration.

#### Capture Phrases Grid

To add a new capture phrase to a trigger, click on the green **\[+ New\]** button on the group header.

The grid columns show, from left to right, the control to change a phrase's position in the grid, the position number, the capture phrase text, a checkbox to enable regular expresions, and the delete button.





## Actions

Actions are executed in response to the parsed capture phrase.  All triggers have two basic properties, the action type and the trigger phrase.  The "Action Type" dropdown will allow you to select the action to be executed.  The "Trigger on Phrase" dropdown allows you to select 1 or more capture phrases that will trigger the action.

#### Action Types

There are many different actions available in Nag.

  Action Type &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| Details
  :------------     | :-------------
  Display Text      | Displays text in an overlay component.
  DoT Timer         | Displays a damage of time timer in a timer overlay.
  Play Audio        | Plays an audio file.
  Speak             | Uses TTS (Text to speech) synthensis to speak to the player.
  Timer             | Displays a general timer in a timer overlay. Timers start empty and fills up as the timer nears the end.
  Countdown         | Displays a genearl countdown in a timer overlay. Countdowns start full and empties as the coundtown nears the end.
  Store Variable    | Stores a captured value into a variable that can be referenced in other triggers.
  Clear Variable    | Clears a stored value.
  Counter           | Keeps a tally based on the capture phrase.
  Clipboard         | Stores a value in the clipboard that they player can paste into the game or other applicaton.
  Beneficial Timer  | Displays a beneficial/buff timer in a timer overlay.
  
#### Display Text Action

![image](https://user-images.githubusercontent.com/66176124/136703706-c9e29b0a-b035-4a7b-8ad1-bb8e4f5eb645.png)

###### Display Text Action Properties

  Property &nbsp;&nbsp;&nbsp;&nbsp;| Description
  :------------       | :-------------
  Display Text        | The text to display in an overlay.
  Overlay Window      | The overlay window selected for display.
  Duration            | The duration the text should appear to the player.
  Custom color        | Displays the text in the given color. If disabled, the overlay defaults are used.
  Custom size         | Changes the size of the text in the overlay. If disabled, the overlay defaults are used.
  Custom spacing      | Changes the vertical line spacing for the text. If disabled, the overlay defaults are used.
  Custom border       | Draws a colored border around the text. If disabled, the overlay defaults are used.
  Custom glow         | Draws a glow around the text. If disabled, the overlay defaults are used.
  Custom glow size    | The size of the custom glow. If zero, the overlay defaults for glow and glow size are used.
  Custom font         | Use the specified font. If disabled, the overlay defaults are used.
  Custom font weight  | When a custom font is used, this will set the font weight. If disabled, the overlay defaults are used.
  
#### DoT Timer Action

The DoT Timer action has several groups of properties available: Timer, Timer Ending, Timer Ended, Exclude Targets, and End Early.  

DoT timers (and beneficial timers) differ from general timers and countdowns in one major way: they both have their durations modified by the current character's focus effects.  There are also different events and properties that are available on DoT/Beneficial timers.

###### DoT Timer: Timer

![image](https://user-images.githubusercontent.com/66176124/136704417-3cd6a0df-0c28-40f3-9ba8-e2f051b777eb.png)

###### DoT Timer: Timer Properties

  Property &nbsp;&nbsp;&nbsp;&nbsp;| Description
  :------------       | :-------------
  Overlay window      | The overlay to display this DoT timer.
  Timer duration      | The duration of the timer.
  Restart behavior    | How should the system handle restarting the timer.
  Show time remaining | If true, the time remaining will be rendered in the timer label, overriding the preferences on the overlay window.
  Use color           | If set, overrides the default color in the overlay window preferences.
  Timer icon          | Allows the user to select an icon for the timer.
  
###### DoT Timer: Timer Ending

Important note: All of the properties in the event tabs should be hidden until they are enabled by selecting the "Notify" checkbox and giving a duration.

![image](https://user-images.githubusercontent.com/66176124/136704746-668e08e8-3ed6-481f-8bc5-1ed1855475cb.png)

###### DoT Timer: Timer Ending Properties

  Property &nbsp;&nbsp;&nbsp;&nbsp;| Description
  :------------         | :-------------
  Notify                | If enabled, with a duration specified, will notify the player when the timer is ending.
  Notify duration       | When the timer is down to #duration, notifications will be executed.
  Change timer color    | Changes the timer color when timer is at or below #duration.
  Display text          | When enabled, allows the user to specify text to display to the user. This accepts regex capture groups and snippets.
  Text overlay window   | The overlay window to render the text.
  Display text duration | The duration to display text.
  Speak phrase          | When enabled, allows the user to specify text for the TTS to say to the user. This accepts regex capture groups and snippets.
  Interrupt speech      | When enabled, if the TTS is currently saying something, that will be interrupted.
  Send to clipboard     | Sends the specified value to the clipboard. This accepts regex capture groups and snippets.
  Play audio            | When enabled, plays the selected audio clip when timer is at #duration.
  Select new audio file | Allows the user to select add a new audio file to the list of options.
  
###### DoT Timer: Timer Ended

Important note: All of the properties in the event tabs should be hidden until they are enabled by selecting the "Notify" checkbox and giving a duration.

![image](https://user-images.githubusercontent.com/66176124/136705318-097209fe-f4da-4fa5-9949-71e73c8edd11.png)

###### DoT Timer: Timer Ended Properties

  Property &nbsp;&nbsp;&nbsp;&nbsp;| Description
  :------------         | :-------------
  Notify when ended     | For DoT timers, when enabled, will keep the timer alive for the specified duration.
  Duration              | The duration to keep the timer alive.
  Timer color           | When the timer ends, changes the color of the timer.
  Execute Actions       | When enabled, allows the user to specify actions to execute when the timer ends.
  Display text          | When enabled, allows the user to specify text to display to the user. This accepts regex capture groups and snippets.
  Text overlay window   | The overlay window to render the text.
  Display text duration | The duration to display text.
  Speak phrase          | When enabled, allows the user to specify text for the TTS to say to the user. This accepts regex capture groups and snippets.
  Interrupt speech      | When enabled, if the TTS is currently saying something, that will be interrupted.
  Send to clipboard     | Sends the specified value to the clipboard. This accepts regex capture groups and snippets.
  Play audio            | When enabled, plays the selected audio clip when timer is at #duration.
  Select new audio file | Allows the user to select add a new audio file to the list of options.

###### DoT Timer: Exclude Targets

Allows the user to specify targets to exclude from executing dot timers.  Like capture phrases, you can use simple text or regular expressions.  Unlike capture phrases, these are only executed against the name of the target of the DoT.

![image](https://user-images.githubusercontent.com/66176124/136705436-f49efb4b-09cd-4f09-aebd-da9377971548.png)

###### DoT Timer: End Early

Allows the user to specify capture phrases that will end the DoT timer early.  Like capture phrases, these are checked against new log entries but are only active when the DoT timer is active.







<!--- #### Variable Trigger Actions --->




## Advanced Ramblings

### Capture and Render snippets

These snippets can be used to easily accomplish commonly repeated tasks in either capture phrases, in timer labels, or in alert texts.

##### Capture Phrase snippets

  Snippet &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| Description | Alt
  :------------     | :------------- | :-------------
  {TS}              | Matches any duration, and uses that value as the duration for any timers/countdowns that are triggered from the capture phrase. | 
  {C}               | Matches your current character's name exactly. | ${Character}
  {S\[0-9\]}        | Matches any string, and can be used in alert messages or timer labels. | 
  {N\[0-9\]}        | Matches any number, and can be used in alert messages or timer labels. | 
  

##### Literal snippets

  Snippet &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| Description | Alt
  :------------     | :------------- | :-------------
  {TS}              | Matches any number or duration, and uses that value as the duration for any timers/countdowns that are triggered from the capture phrase. | 
  {C}               | Matches your current character's name exactly. | ${Character}
  +{_CounterName_}  | Prints the current value of _CounterName_. | 
  {S\[0-9\]}        | When matched with a capture phrase, renders the matched value in text and labels. | 
  {N\[0-9\]}        | When matched with a capture phrase, renders the matched value in text and labels. | 
  {L}               | Renders the matched log entry in text and labels. | 

#### Variable storage mechanics

  Because latency is a thing, behind the scenes each variable can contain multiple values that are stored in an array.  When a check is performed, the operators work as detailed here:

  Operator &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| Details
  :------------     | :-------------
  Is empty          | Checks if the array length is greater than 0 and returns false if that condition is true.
  Equals            | Checks if the array contains an element that matches exactly one of the given value(s).
  Is not equal to   | Checks if the array contains the exact value(s), and if found returns false.
  Contains          | Checks if the array contains an element that matches the given value. The match is not case-sensitive.
