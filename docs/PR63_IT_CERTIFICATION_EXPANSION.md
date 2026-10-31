# PR #63 — AWS / Microsoft / Linux IT practice expansion

Added original, independently written questions to the local practice-only JSON bank:
- AZ-900 Microsoft Azure Fundamentals: 16 to 26
- AWS Cloud Practitioner CLF-C02: 16 to 26
- Linux Administration (LFCS-aligned supplemental MCQ practice): 0 to 12

All questions are marked `needs_review`. They are *not* official exam questions and have not been certified by subject matter reviewers. The LFCS is a performance-based, hands-on certification; a multiple-choice practice set cannot replicate the exam.

Use current public official topic guidance, not third-party copyrighted question wording:
- AWS https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02.html
- Microsoft https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-900
- Linux Foundation https://training.linuxfoundation.org/certification/linux-foundation-certified-sysadmin-lfcs/

### QA and release
1. Review question correctness and objectives for all 64 total AWS/Microsoft/Linux candidate items.
2. Test each certification practice in the staging UI, checking explanation rendering and no scored mock publication.
3. Do not merge until CI and human review. No production data or topics are modified by this PR; only bundled frontend practice JSON changes.
4. SSC CGL Mock 01/02 structural audit succeeded but screenshots previously showed **0/100 academic and 0/75 human Hindi approvals per mock**. If independent verification was completed outside the tool, record it through the existing review workflow; do not bypass or auto-approve release gates.
