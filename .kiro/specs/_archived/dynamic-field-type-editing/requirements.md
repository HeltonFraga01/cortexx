# Requirements Document

## Introduction

This feature enhances the database record editing functionality to support type-aware field inputs. Currently, all fields are rendered as plain text inputs regardless of their actual data type in NocoDB. This causes validation errors and breaks automations when users enter data in incorrect formats (e.g., entering free text in a single-select field that expects specific values). The system must detect each field's type from NocoDB metadata and render appropriate input components (select dropdowns, checkboxes, date pickers, etc.) to ensure data integrity.

## Glossary

- **NocoDB_System**: The external database management system that provides table schemas and field type metadata
- **Edit_Record_Page**: The user interface page located at `/user/database/:connectionId/edit/:recordId` that allows users to modify existing database records
- **Field_Type_Metadata**: The schema information returned by NocoDB API that describes each field's data type, constraints, and valid options
- **Type_Aware_Input**: A form input component that matches the specific data type requirements of a database field
- **Field_Mapper**: The existing system component that maps NocoDB fields to display names and handles field configuration
- **User_Token**: The authentication token that scopes database access to specific users

## Requirements

### Requirement 1

**User Story:** As a user editing a database record, I want to see appropriate input controls for each field type, so that I can enter data in the correct format without causing validation errors

#### Acceptance Criteria

1. WHEN the Edit_Record_Page loads, THE NocoDB_System SHALL provide Field_Type_Metadata for all fields in the table
2. WHEN Field_Type_Metadata indicates a "SingleSelect" type, THE Edit_Record_Page SHALL render a dropdown select component that displays all valid options from the field configuration
3. WHEN a user clicks on a SingleSelect field, THE Edit_Record_Page SHALL open a dropdown menu with all available options for selection
4. WHEN Field_Type_Metadata indicates a "MultiSelect" type, THE Edit_Record_Page SHALL render a multi-select component that allows selecting multiple values from valid options
5. WHEN a user clicks on a MultiSelect field, THE Edit_Record_Page SHALL open a dropdown menu with checkboxes for each available option
6. WHEN Field_Type_Metadata indicates a "Checkbox" type, THE Edit_Record_Page SHALL render a checkbox toggle component
7. WHEN Field_Type_Metadata indicates a "Date" type, THE Edit_Record_Page SHALL render a date picker component with calendar popup
8. WHEN a user clicks on a Date field, THE Edit_Record_Page SHALL open an inline calendar interface for date selection

### Requirement 2

**User Story:** As a user editing numeric and text fields, I want appropriate input controls that validate my entries, so that I can ensure data quality before saving

#### Acceptance Criteria

1. WHEN Field_Type_Metadata indicates a "Number" type, THE Edit_Record_Page SHALL render a numeric input with validation for numeric values only
2. WHEN Field_Type_Metadata indicates a "Decimal" type, THE Edit_Record_Page SHALL render a numeric input with decimal point support
3. WHEN Field_Type_Metadata indicates a "SingleLineText" type, THE Edit_Record_Page SHALL render a single-line text input
4. WHEN Field_Type_Metadata indicates a "LongText" type, THE Edit_Record_Page SHALL render a textarea component
5. WHEN Field_Type_Metadata indicates a "Currency" or "Percent" type, THE Edit_Record_Page SHALL render a numeric input with appropriate formatting

### Requirement 3

**User Story:** As a user editing specialized field types, I want appropriate input controls for dates, times, emails, and other formatted data, so that I can enter valid data efficiently

#### Acceptance Criteria

1. WHEN Field_Type_Metadata indicates a "DateTime" type, THE Edit_Record_Page SHALL render a combined date and time picker component
2. WHEN a user clicks on a DateTime field, THE Edit_Record_Page SHALL open an inline calendar with time selection interface
3. WHEN Field_Type_Metadata indicates a "Time" type, THE Edit_Record_Page SHALL render a time picker component
4. WHEN a user clicks on a Time field, THE Edit_Record_Page SHALL open a time selection interface with hour and minute controls
5. WHEN Field_Type_Metadata indicates an "Email" type, THE Edit_Record_Page SHALL render a text input with email format validation
6. WHEN Field_Type_Metadata indicates a "PhoneNumber" type, THE Edit_Record_Page SHALL render a text input with phone number format validation
7. WHEN Field_Type_Metadata indicates a "URL" type, THE Edit_Record_Page SHALL render a text input with URL format validation

### Requirement 4

**User Story:** As a user, I want the system to fetch and cache field type information efficiently, so that the edit page loads quickly without unnecessary API calls

#### Acceptance Criteria

1. WHEN the Edit_Record_Page loads for a specific table, THE NocoDB_System SHALL fetch Field_Type_Metadata once per session
2. WHEN Field_Type_Metadata is successfully retrieved, THE Edit_Record_Page SHALL cache the metadata for subsequent record edits in the same table
3. WHEN a user navigates to edit another record in the same table, THE Edit_Record_Page SHALL reuse cached Field_Type_Metadata without additional API calls
4. WHEN Field_Type_Metadata fetch fails, THE Edit_Record_Page SHALL fall back to rendering text inputs and display an error message
5. WHEN a user switches to a different database table, THE Edit_Record_Page SHALL fetch new Field_Type_Metadata for that table

### Requirement 5

**User Story:** As a user submitting edited data, I want the system to validate my inputs against field type requirements before saving, so that I receive immediate feedback on any errors

#### Acceptance Criteria

1. WHEN a user attempts to save a record, THE Edit_Record_Page SHALL validate all Type_Aware_Input values against their field type constraints
2. IF any Type_Aware_Input contains invalid data for its field type, THEN THE Edit_Record_Page SHALL display field-specific error messages and prevent submission
3. WHEN all Type_Aware_Input values pass validation, THE Edit_Record_Page SHALL submit the data to NocoDB_System in the correct format
4. WHEN NocoDB_System returns a validation error, THE Edit_Record_Page SHALL display the error message to the user
5. WHEN the save operation succeeds, THE Edit_Record_Page SHALL display a success message and redirect to the table view

### Requirement 6

**User Story:** As a user with existing field mapper configurations, I want the new type-aware inputs to respect my custom field names and visibility settings, so that my workflow remains consistent

#### Acceptance Criteria

1. WHEN Field_Mapper has custom display names configured, THE Edit_Record_Page SHALL use those names as labels for Type_Aware_Input components
2. WHEN Field_Mapper marks a field as hidden, THE Edit_Record_Page SHALL exclude that field from the edit form
3. WHEN Field_Mapper specifies a field order, THE Edit_Record_Page SHALL render Type_Aware_Input components in that order
4. WHEN Field_Mapper configuration is not available, THE Edit_Record_Page SHALL use default field names from Field_Type_Metadata
5. THE Edit_Record_Page SHALL maintain compatibility with existing Field_Mapper functionality without breaking changes
