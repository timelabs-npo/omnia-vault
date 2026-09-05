#!/usr/bin/env python3
import hashlib, json, struct, sys
from pathlib import Path

CHUNK = 4_194_304

def tag(s): return s.encode("ascii") + b"\0"
def u8(n): return struct.pack(">B", n)
def u32(n): return struct.pack(">I", n)
def u64(n): return struct.pack(">Q", n)
def sha(b): return hashlib.sha256(b).digest()
def hx(b): return b.hex()

def chunk_records(data: bytes):
    if not data:
        return []
    return [(sha(data[i:i+CHUNK]), len(data[i:i+CHUNK])) for i in range(0, len(data), CHUNK)]

def file_manifest_bytes(data: bytes):
    recs = chunk_records(data)
    out = bytearray(tag("OMNIA-FILE-V1"))
    out += u64(len(data)) + u32(len(recs))
    for dig, ln in recs:
        out += dig + u32(ln)
    return bytes(out)

def file_manifest_id(data: bytes): return sha(file_manifest_bytes(data))

def tree_bytes(entries):
    ordered = sorted(entries, key=lambda x: x[0])
    if any(len(i) != 16 or len(m) != 32 for i,m in ordered): raise ValueError("wrong tree field width")
    if any(ordered[i-1][0] >= ordered[i][0] for i in range(1, len(ordered))): raise ValueError("duplicate or unsorted item IDs")
    out = bytearray(tag("OMNIA-TREE-V1")); out += u32(len(ordered))
    for item, manifest in ordered: out += item + manifest
    return bytes(out)

def tree_id(entries): return sha(tree_bytes(entries))

def revision_bytes(workspace, replica, actor, operation, generation, parent, tree):
    for x,n in [(workspace,16),(replica,16),(actor,16),(operation,16),(tree,32)]:
        if len(x) != n: raise ValueError("wrong revision field width")
    out = bytearray(tag("OMNIA-REV-V1")); out += workspace + replica + actor + operation + u64(generation)
    if parent is None:
        if generation != 0: raise ValueError("parentless revision only valid at generation 0")
        out += u8(0)
    else:
        if generation == 0 or len(parent) != 32: raise ValueError("invalid parent")
        out += u8(1) + parent
    out += tree
    return bytes(out)

def revision_id(*args): return sha(revision_bytes(*args))

def publish_request_digest(actor, workspace, replica, operation, expected_revision, expected_generation, item, manifest):
    widths = [(actor,16),(workspace,16),(replica,16),(operation,16),(expected_revision,32),(item,16),(manifest,32)]
    if any(len(x)!=n for x,n in widths): raise ValueError("wrong publish field width")
    return sha(tag("OMNIA-PUBLISH-V1") + actor + workspace + replica + operation + expected_revision + u64(expected_generation) + item + manifest)

def init_request_digest(owner, actor, workspace, replica, operation):
    widths = [(owner,16),(actor,16),(workspace,16),(replica,16),(operation,16)]
    if any(len(x)!=n for x,n in widths): raise ValueError("wrong init field width")
    return sha(tag("OMNIA-INIT-V1") + owner + actor + workspace + replica + operation)

def publish_receipt_bytes(kind, owner, actor, workspace, replica, operation, request_digest, expected_revision, expected_generation, result_revision, result_generation, item, manifest):
    if kind not in (1,2): raise ValueError("invalid kind")
    widths = [(owner,16),(actor,16),(workspace,16),(replica,16),(operation,16),(request_digest,32),(expected_revision,32),(result_revision,32),(item,16),(manifest,32)]
    if any(len(x)!=n for x,n in widths): raise ValueError("wrong receipt field width")
    return tag("OMNIA-RECEIPT-V1") + u8(kind) + owner + actor + workspace + replica + operation + request_digest + expected_revision + u64(expected_generation) + result_revision + u64(result_generation) + item + manifest

def bootstrap_receipt_bytes(owner, actor, workspace, replica, operation, request_digest, genesis_revision, empty_tree):
    widths = [(owner,16),(actor,16),(workspace,16),(replica,16),(operation,16),(request_digest,32),(genesis_revision,32),(empty_tree,32)]
    if any(len(x)!=n for x,n in widths): raise ValueError("wrong bootstrap field width")
    return tag("OMNIA-INIT-RECEIPT-V1") + owner + actor + workspace + replica + operation + request_digest + genesis_revision + u64(0) + empty_tree

def pattern(n):
    seed = bytes(range(251)); q,r = divmod(n, len(seed)); return seed*q + seed[:r]

def vectors():
    owner=bytes(range(0x00,0x10)); actor=bytes(range(0x10,0x20)); workspace=bytes(range(0x20,0x30)); replica=bytes(range(0x30,0x40)); bootstrap_op=bytes(range(0x40,0x50)); op1=bytes(range(0x50,0x60)); item1=bytes(range(0x60,0x70)); item2=bytes(range(0x70,0x80))
    empty_tree_b=tree_bytes([]); empty_tree=sha(empty_tree_b); init_req=init_request_digest(owner,actor,workspace,replica,bootstrap_op); genesis_b=revision_bytes(workspace,replica,actor,bootstrap_op,0,None,empty_tree); genesis=sha(genesis_b); init_receipt_b=bootstrap_receipt_bytes(owner,actor,workspace,replica,bootstrap_op,init_req,genesis,empty_tree)
    cases=[]
    for name,data in [("empty",b""),("single_zero",b"\x00"),("chunk_minus_1_pattern251",pattern(CHUNK-1)),("chunk_exact_pattern251",pattern(CHUNK)),("chunk_plus_1_pattern251",pattern(CHUNK+1)),("repeated_two_chunks_A",b"A"*(CHUNK*2))]:
        mb=file_manifest_bytes(data); recs=chunk_records(data); cases.append({"name":name,"length":len(data),"input_sha256":hx(sha(data)),"chunk_count":len(recs),"chunks":[{"object_id":hx(d),"length":ln} for d,ln in recs],"manifest_bytes_sha256":hx(sha(mb)),"file_manifest_id":hx(sha(mb))})
    data1=b"alpha\x00beta"; data2=b"\xff"*33; m1=file_manifest_id(data1); m2=file_manifest_id(data2); t12=tree_bytes([(item1,m1),(item2,m2)]); t21=tree_bytes([(item2,m2),(item1,m1)]); assert t12==t21; tree12=sha(t12)
    req=publish_request_digest(actor,workspace,replica,op1,genesis,0,item1,m1); rev1b=revision_bytes(workspace,replica,actor,op1,1,genesis,tree12); rev1=sha(rev1b); commit_receipt=publish_receipt_bytes(1,owner,actor,workspace,replica,op1,req,genesis,0,rev1,1,item1,m1); conflict_receipt=publish_receipt_bytes(2,owner,actor,workspace,replica,op1,req,genesis,0,rev1,1,item1,m1); max_rev_b=revision_bytes(workspace,replica,actor,op1,2**63-1,genesis,tree12)
    return {"schema_version":1,"contract_version":"OMNIA-LIT-001/v1.1","chunk_size":CHUNK,"ids":{"owner_id":hx(owner),"actor_id":hx(actor),"workspace_id":hx(workspace),"replica_id":hx(replica),"bootstrap_operation_id":hx(bootstrap_op),"publish_operation_id":hx(op1),"item1_id":hx(item1),"item2_id":hx(item2)},"genesis":{"empty_tree_bytes_hex":hx(empty_tree_b),"empty_tree_id":hx(empty_tree),"init_request_digest":hx(init_req),"genesis_revision_bytes_hex":hx(genesis_b),"genesis_revision_id":hx(genesis),"bootstrap_receipt_bytes_hex":hx(init_receipt_b),"bootstrap_receipt_digest":hx(sha(init_receipt_b))},"file_cases":cases,"ordering":{"item1_manifest_id":hx(m1),"item2_manifest_id":hx(m2),"tree_id_input_1_then_2":hx(sha(t12)),"tree_id_input_2_then_1":hx(sha(t21)),"canonical_bytes_equal":t12==t21},"publish_example":{"request_digest":hx(req),"revision1_id":hx(rev1),"revision1_bytes_hex":hx(rev1b),"commit_receipt_bytes_hex":hx(commit_receipt),"commit_receipt_digest":hx(sha(commit_receipt)),"conflict_receipt_bytes_hex":hx(conflict_receipt),"conflict_receipt_digest":hx(sha(conflict_receipt))},"max_generation_example":{"generation":str(2**63-1),"revision_id":hx(sha(max_rev_b))}}

if __name__ == "__main__":
    out=vectors(); Path(sys.argv[1]).write_text(json.dumps(out,indent=2,sort_keys=True)+"\n") if len(sys.argv)>1 else print(json.dumps(out,indent=2,sort_keys=True))
