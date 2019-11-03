const immutable = require('immutable')
const octopart = require('./octopart')
const lcsc = require('./lcsc')

function search(queries) {
  return Promise.all([octopart(queries), lcsc(queries)]).then(
    async ([octopart_responses, lcsc_responses]) => {
      let [merged, remaining_lcsc] = merge(octopart_responses, lcsc_responses)
      const further_octopart = remaining_lcsc
        .filter(x => x)
        .map((response, query) => {
          const original_query = query
          return query
            .merge({original_query})
            .remove('sku')
            .remove('id')
            .set('mpn', response.get('mpn'))
        })
      let rs = await octopart(further_octopart)
      rs = rs.mapEntries(([query, response]) => [query.get('original_query'), response])
      ;[merged, remaining_lcsc] = merge(rs.merge(merged), remaining_lcsc)
      return merged.merge(remaining_lcsc).mapEntries(([query, response]) => {
        if (!query.get('term') && immutable.List.isList(response)) {
          return [query, response.first()]
        }
        return [query, response]
      })
    }
  )
}

function merge(octopart_responses, lcsc_responses) {
  let remaining_lcsc = lcsc_responses
  const merged = octopart_responses
    .filter(r => r && r.get('offers'))
    .mapEntries(([query, response]) => {
      const lcsc_response = lcsc_responses.get(query)
      if (lcsc_response != null && lcsc_response.get('offers')) {
        remaining_lcsc = remaining_lcsc.remove(query)
        // overwrite octopart offer data with the more up-to-date better data from lcsc
        const lcsc_offers = lcsc_response.get('offers')
        const lcsc_skus = lcsc_offers.map(o => o.get('sku'))
        const offers = response
          .get('offers')
          .filter(o => !lcsc_skus.find(sku => sku.equals(o.get('sku'))))
          .concat(lcsc_offers)
        response = response.set('offers', offers)
        return [query, response]
      }
    })
  return [merged, remaining_lcsc]
}

module.exports = search
