# DealOrbit Rotation System

A dynamic round-robin queue system for equitably distributing finance deals among managers in a car dealership.

## Features

### Core Objectives
- **Fairness**: Every manager gets equal opportunity, preventing overload. No manager gets back-to-back deals unless they are the only one in rotation.
- **Efficiency**: Assigns deals quickly to the next eligible manager.
- **Adaptability**: Adjusts to staffing changes, with new managers integrated based on entry time.
- **Transparency & Auditability**: Maintains a static deal log with Deal #1 at the top, appending new deals below without moving existing rows.

### Rotation Mechanics

1. **Initial Setup**: Managers are added to `rotationOrder` array in the order they enter rotation, tracked with `rotationTimestamp`. Uses `dailyDeals` object to count deals per manager per day.

2. **Deal Assignment**: 
   - Managers added first have first priority in getting a deal.
   - Managers who are added without a deal get first priority so long as they have not gotten a deal yet.
   - The next deal goes to the earliest added manager (lowest `rotationTimestamp`) who has not gotten a deal that day.
   - If all managers have at least one deal, cycles back to the earliest added manager (lowest `rotationTimestamp`).
   - Ensures no back-to-back assignments by checking if the next manager is the same as the last assigned.

3. **New Manager Addition**: When a new manager is added, they are appended to `rotationOrder`. They will get priority only after all earlier-added managers without deals have received their first deal.

4. **Static Deal Log**: The "Deals" table is fixed; once logged, rows do not move. Uses `dealRows` to track by `dealId`.

5. **Rotation Queue Management**: `rotationQueue` mirrors `rotationOrder` for active managers (inRotation: true). Updates after each deal or manager change.

## Usage

### Adding Managers
1. Enter a manager name in the "Manager Management" section
2. Click "Add Manager" or press Enter
3. The manager is added to the rotation with a timestamp

### Logging Deals
1. Fill in all required fields:
   - Customer Last Name
   - Salesperson
   - Vehicle Sold
   - Stock #
   - Finance Type
2. The F&I Manager is automatically assigned based on rotation
3. Click "Log Deal" to record the deal

### Managing Rotation
- Toggle managers in/out of rotation using the "Add to Rotation" / "Remove from Rotation" buttons
- The rotation display shows:
  - **NEXT**: The manager who will receive the next deal
  - **LAST**: The manager who received the last deal
  - Deal counts for each manager today

### Reset Functions
- **Trash Deal Log**: Clears all deals and daily counts, but preserves the rotation order
- **Daily Reset**: Automatically runs at 1 AM PDT to:
  - Clear all deals
  - Reset daily deal counts
  - Remove inactive managers from rotation

## State Persistence

All data is automatically saved to localStorage:
- `dealOrbit_managers`: Manager information and rotation status
- `dealOrbit_dealHistory`: Complete deal history
- `dealOrbit_rotationOrder`: Order of managers in rotation
- `dealOrbit_dailyDeals`: Daily deal counts per manager
- `dealOrbit_lastAssigned`: Last assigned manager (prevents back-to-back)

## Technical Details

- **Table Structure**: Columns include F&I, Time, Customer Last Name, Salesperson, Vehicle Sold, Stock #, Deal #, Finance Type
- **Deal Numbering**: Sequential, starting from 1
- **Time Zone**: All daily resets and date calculations use PDT (Pacific Daylight Time)
- **Browser Compatibility**: Modern browsers with localStorage support

## Example Workflow

1. Andrew added at 9 AM: `rotationOrder = ["Andrew"]`
2. Deals logged: Andrew gets them until Jacob added at 12 PM: `rotationOrder = ["Andrew", "Jacob"]`
3. Next deal goes to Andrew (earliest added, still has 0 deals if none logged yet)
4. Once Andrew has a deal and Jacob doesn't, Jacob gets the next deal
5. All have a deal: Cycle back to Andrew (earliest added)

