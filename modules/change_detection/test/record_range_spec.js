import {ddescribe, describe, it, iit, xit, expect, beforeEach} from 'test_lib/test_lib';

import {List, ListWrapper, MapWrapper} from 'facade/collection';
import {isPresent} from 'facade/lang';
import {Parser} from 'change_detection/parser/parser';
import {Lexer} from 'change_detection/parser/lexer';

import {
  ChangeDetector,
  ProtoRecordRange,
  RecordRange,
  ProtoRecord,
  RECORD_TYPE_CONST
  } from 'change_detection/change_detector';

import {Record} from 'change_detection/record';

export function main() {
  var lookupName = (names, item) =>
    ListWrapper.last(
      ListWrapper.find(names, (pair) => pair[0] === item));

  function enabledRecordsInReverseOrder(rr:RecordRange, names:List) {
    var reversed = [];
    var record = rr.findLastEnabledRecord();
    while (isPresent(record)) {
      ListWrapper.push(reversed, lookupName(names, record));
      record = record.prevEnabled;
    }
    return reversed;
  }

  function enabledRecords(rr:RecordRange, names:List) {
    var res = [];
    var record = rr.findFirstEnabledRecord();
    while (isPresent(record)) {
      ListWrapper.push(res, lookupName(names, record));
      record = record.nextEnabled;
    }

    // check that all links are set properly in both directions
    var reversed = enabledRecordsInReverseOrder(rr, names);
    expect(res).toEqual(ListWrapper.reversed(reversed));

    return res;
  }

  function createRecord(rr) {
    return new Record(rr, new ProtoRecord(null, 0, null, null, null, null, null, null), null);
  }

  describe('record range', () => {
    it('should add records', () => {
      var rr = new RecordRange(null, null);
      var record1 = createRecord(rr);
      var record2 = createRecord(rr);

      rr.addRecord(record1);
      rr.addRecord(record2);

      expect(enabledRecords(rr, [
        [record1, 'record1'],
        [record2, 'record2']
      ])).toEqual(['record1', 'record2']);
    });

    describe('adding/removing record ranges', () => {
      var parent, child1, child2, child3;
      var childRecord1, childRecord2, childRecord3;
      var recordNames;

      beforeEach(() => {
        parent = new RecordRange(null, null);

        child1 = new RecordRange(null, null);
        childRecord1 = createRecord(child1);
        child1.addRecord(childRecord1);

        child2 = new RecordRange(null, null);
        childRecord2 = createRecord(child2);
        child2.addRecord(childRecord2);

        child3 = new RecordRange(null, null);
        childRecord3 = createRecord(child3);
        child3.addRecord(childRecord3);

        recordNames = [
          [childRecord1, 'record1'],
          [childRecord2, 'record2'],
          [childRecord3, 'record3']
        ];
      });

      it('should add record ranges', () => {
        parent.addRange(child1);
        parent.addRange(child2);

        expect(enabledRecords(parent, recordNames)).toEqual(['record1', 'record2']);
      });

      it('should handle adding an empty range', () => {
        var emptyRange = new RecordRange(null, null);
        parent.addRange(child1);
        parent.addRange(child2);
        child1.addRange(emptyRange);

        expect(enabledRecords(parent, recordNames)).toEqual(['record1', 'record2']);
      });

      it('should handle enabling/disabling an empty range', () => {
        var emptyRange = new RecordRange(null, null);
        emptyRange.disable();
        emptyRange.enable();

        expect(enabledRecords(emptyRange, recordNames)).toEqual([]);
      });

      it('should handle adding a range into an empty range', () => {
        var emptyRange = new RecordRange(null, null);
        parent.addRange(emptyRange);
        parent.addRange(child2);

        emptyRange.addRange(child1);

        expect(enabledRecords(parent, recordNames)).toEqual(['record1', 'record2']);
      });

      it('should add nested record ranges', () => {
        parent.addRange(child1);
        child1.addRange(child2);

        expect(enabledRecords(parent, recordNames)).toEqual(['record1', 'record2']);
      });

      it('should remove record ranges', () => {
        parent.addRange(child1);
        parent.addRange(child2);

        child1.remove();

        expect(enabledRecords(parent, recordNames)).toEqual(['record2']);

        child2.remove();

        expect(enabledRecords(parent, recordNames)).toEqual([]);
      });

      it('should remove an empty record range', () => {
        var emptyRange = new RecordRange(null, null);
        parent.addRange(child1);
        parent.addRange(emptyRange);
        parent.addRange(child2);

        emptyRange.remove();

        expect(enabledRecords(parent, recordNames)).toEqual(['record1', 'record2']);
      });

      it('should remove a record range surrounded by other ranges', () => {
        parent.addRange(child1);
        parent.addRange(child2);
        parent.addRange(child3);

        child2.remove();

        expect(enabledRecords(parent, recordNames)).toEqual(['record1', 'record3']);
      });
    });

    describe('enabling/disabling records', () => {
      var rr;
      var record1, record2, record3, record4;
      var recordNames;

      beforeEach(() => {
        rr = new RecordRange(null, null);
        record1 = createRecord(rr);
        record2 = createRecord(rr);
        record3 = createRecord(rr);
        record4 = createRecord(rr);

        recordNames = [
          [record1, 'record1'],
          [record2, 'record2'],
          [record3, 'record3'],
          [record4, 'record4']
        ];
      });

      it('should disable a single record', () => {
        rr.addRecord(record1);

        record1.disable();

        expect(enabledRecords(rr, recordNames)).toEqual([]);
      });

      it('should enable a single record', () => {
        rr.addRecord(record1);
        record1.disable();

        record1.enable();

        expect(enabledRecords(rr, recordNames)).toEqual(['record1']);
      });

      it('should disable a record', () => {
        rr.addRecord(record1);
        rr.addRecord(record2);
        rr.addRecord(record3);
        rr.addRecord(record4);

        record2.disable();
        record3.disable();

        expect(record2.isDisabled()).toBeTruthy();
        expect(record3.isDisabled()).toBeTruthy();

        expect(enabledRecords(rr, recordNames)).toEqual(['record1', 'record4']);
      });

      it('should enable a record', () => {
        rr.addRecord(record1);
        rr.addRecord(record2);
        rr.addRecord(record3);
        rr.addRecord(record4);
        record2.disable();
        record3.disable();

        record2.enable();
        record3.enable();

        expect(enabledRecords(rr, recordNames)).toEqual(['record1', 'record2', 'record3', 'record4']);
      });

      it('should disable a single record in a range', () => {
        var rr1 = new RecordRange(null, null);
        rr1.addRecord(record1);

        var rr2 = new RecordRange(null, null);
        rr2.addRecord(record2);

        var rr3 = new RecordRange(null, null);
        rr3.addRecord(record3);

        rr.addRange(rr1);
        rr.addRange(rr2);
        rr.addRange(rr3);

        record2.disable();

        expect(enabledRecords(rr, recordNames)).toEqual(['record1', 'record3']);

        record2.enable();

        expect(enabledRecords(rr, recordNames)).toEqual(['record1', 'record2', 'record3']);
      });
    });

    describe('enabling/disabling record ranges', () => {
      var child1, child2, child3, child4;
      var record1, record2, record3, record4;
      var recordNames;

      beforeEach(() => {
        child1 = new RecordRange(null, null);
        record1 = createRecord(child1);
        child1.addRecord(record1);

        child2 = new RecordRange(null, null);
        record2 = createRecord(child2);
        child2.addRecord(record2);

        child3 = new RecordRange(null, null);
        record3 = createRecord(child3);
        child3.addRecord(record3);

        child4 = new RecordRange(null, null);
        record4 = createRecord(child4);
        child4.addRecord(record4);

        recordNames = [
          [record1, 'record1'],
          [record2, 'record2'],
          [record3, 'record3'],
          [record4, 'record4']
        ];
      });

      it('should disable a single record range', () => {
        var parent = new RecordRange(null, null);
        parent.addRange(child1);

        child1.disable();

        expect(enabledRecords(parent, recordNames)).toEqual([]);
      });

      it('should enable a single record range', () => {
        var parent = new RecordRange(null, null);
        parent.addRange(child1);

        child1.disable();

        child1.enable();

        expect(enabledRecords(parent, recordNames)).toEqual(['record1']);
      });

      it('should disable a record range', () => {
        var parent = new RecordRange(null, null);
        parent.addRange(child1);
        parent.addRange(child2);
        parent.addRange(child3);
        parent.addRange(child4);

        child2.disable();
        child3.disable();

        expect(enabledRecords(parent, recordNames)).toEqual(['record1', 'record4']);
      });

      it('should enable a record range', () => {
        var parent = new RecordRange(null, null);
        parent.addRange(child1);
        parent.addRange(child2);
        parent.addRange(child3);
        parent.addRange(child4);

        child2.disable();
        child2.disable();

        child2.enable();
        child3.enable();

        expect(enabledRecords(parent, recordNames)).toEqual([
          'record1', 'record2', 'record3', 'record4'
        ]);
      });
    });

    describe("inspect", () => {
      it("should return the description of the record", () => {
        var proto = new ProtoRecord(null, RECORD_TYPE_CONST, 1, 0, "name", null, "group", "expression");
        var record = new Record(null, proto, null);

        var i = record.inspect();
        expect(i.description).toContain("const, name, enabled");
      });

      it("should return the description of the records in the range", () => {
        var proto = new ProtoRecord(null, RECORD_TYPE_CONST, 1, 0, "name", null, "group", "expression");
        var record = new Record(null, proto, null);
        var range = new RecordRange(null, null);
        range.addRecord(record);

        var i = range.inspect();;
        expect(i.length).toEqual(1);
        expect(i[0]).toContain("const, name, enabled");
      });
    });
  });
}
